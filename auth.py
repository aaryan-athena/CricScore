import pyrebase
import requests
import json

def init_firebase():
    firebaseConfig = {
    "apiKey": "AIzaSyCp9vKJbz1tQyESA-a4hV-vfKGy_dcEjd8",
    "authDomain": "cricscrore.firebaseapp.com",
    "databaseURL": "https://cricscrore-default-rtdb.firebaseio.com",
    "projectId": "cricscrore",
    "storageBucket": "cricscrore.firebasestorage.app",
    "messagingSenderId": "419394189961",
    "appId": "1:419394189961:web:8e112a384c4deb8308a458",
    "measurementId": "G-ZY1HB5P8YH"
}
    firebase = pyrebase.initialize_app(firebaseConfig)
    return firebase

def register_coach(firebase, username, email, team, password):
    try:
        auth = firebase.auth()
        db = firebase.database()
        
        # Create user with Firebase Auth using real email
        user = auth.create_user_with_email_and_password(email, password)
        
        # Store additional user data (team name) in Realtime Database
        user_data = {
            "username": username,
            "team": team.strip(),
            "email": email,
            "uid": user['localId']
        }
        
        # Store user data using UID as key
        db.child("coach_profiles").child(user['localId']).set(user_data)
        
        # Also store username mapping for easy lookup
        db.child("username_mapping").child(username).set(user['localId'])
        
        return True, "Registration successful"
        
    except Exception as e:
        error_message = str(e)
        if "EMAIL_EXISTS" in error_message:
            return False, "Email already exists"
        elif "WEAK_PASSWORD" in error_message:
            return False, "Password should be at least 6 characters"
        else:
            return False, f"Registration failed: {error_message}"

def login_coach(firebase, email, password):
    try:
        auth = firebase.auth()
        db = firebase.database()
        
        # Sign in with Firebase Auth using real email
        user = auth.sign_in_with_email_and_password(email, password)
        
        # Get user profile data
        user_data = db.child("coach_profiles").child(user['localId']).get().val()
        
        if user_data:
            return True, user_data['team'], user['localId'], user['idToken']
        else:
            return False, None, None, None
            
    except Exception as e:
        error_message = str(e)
        if "INVALID_EMAIL" in error_message or "EMAIL_NOT_FOUND" in error_message:
            return False, None, None, None
        elif "INVALID_PASSWORD" in error_message:
            return False, None, None, None
        else:
            return False, None, None, None

def send_password_reset(firebase, email):
    try:
        auth = firebase.auth()
        
        print(f"Attempting to send password reset email to: {email}")
        
        # Send password reset email to the real email
        auth.send_password_reset_email(email)
        
        print(f"Password reset email sent successfully to: {email}")
        return True, "Password reset email sent successfully"
        
    except Exception as e:
        error_message = str(e)
        print(f"Error sending password reset email: {error_message}")
        
        if "EMAIL_NOT_FOUND" in error_message:
            return False, "No account found with this email address"
        elif "INVALID_EMAIL" in error_message:
            return False, "Invalid email address format"
        elif "TOO_MANY_ATTEMPTS_TRY_LATER" in error_message:
            return False, "Too many attempts. Please try again later"
        else:
            return False, f"Failed to send reset email. Please try again"

def verify_token(firebase, token):
    try:
        auth = firebase.auth()
        # Verify the token
        user = auth.get_account_info(token)
        return True, user
    except:
        return False, None
