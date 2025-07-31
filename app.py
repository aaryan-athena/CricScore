from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import pandas as pd
import json
from auth import init_firebase, register_coach, login_coach, send_password_reset
from players import fetch_players, save_player, fetch_matches, save_match, delete_player, delete_match

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'  # Change this in production

# Initialize Firebase
firebase = init_firebase()
db = firebase.database()

@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/login')
def login_page():
    if 'logged_in' in session and session['logged_in']:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        team = data.get('team')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if not username or not email or not team or not password:
            return jsonify({'success': False, 'message': 'All fields are required.'})
        
        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match.'})
        
        success, message = register_coach(firebase, username, email, team, password)
        return jsonify({'success': success, 'message': message})
    
    return render_template('register.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    success, team, uid, token = login_coach(firebase, email, password)
    if success:
        # Get user profile to get the username
        user_data = db.child("coach_profiles").child(uid).get().val()
        username = user_data.get('username', email) if user_data else email
        
        session['logged_in'] = True
        session['email'] = email
        session['username'] = username
        session['team'] = team
        session['uid'] = uid
        session['token'] = token
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'})

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'})
    
    success, message = send_password_reset(firebase, email)
    return jsonify({'success': success, 'message': message})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    if 'logged_in' not in session or not session['logged_in']:
        return redirect(url_for('index'))
    
    username = session['username']
    team = session['team']
    uid = session['uid']
    df = fetch_players(db, uid)
    
    # Convert DataFrame to dict for JSON serialization
    players_data = df.to_dict('index') if not df.empty else {}
    
    return render_template('dashboard.html', 
                         username=username, 
                         team=team, 
                         players=players_data)

@app.route('/api/players', methods=['GET'])
def get_players():
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    uid = session['uid']
    df = fetch_players(db, uid)
    players_data = df.to_dict('index') if not df.empty else {}
    
    return jsonify({'success': True, 'players': players_data})

@app.route('/api/players', methods=['POST'])
def add_player():
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.get_json()
    uid = session['uid']
    name = data.get('name', '').strip()
    role = data.get('role')
    
    if not name:
        return jsonify({'success': False, 'message': 'Player name cannot be empty'})
    
    success, message = save_player(db, uid, name, role)
    return jsonify({'success': success, 'message': message})

@app.route('/api/players/<player_name>', methods=['DELETE'])
def remove_player(player_name):
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    uid = session['uid']
    delete_player(db, uid, player_name)
    return jsonify({'success': True, 'message': f'Player {player_name} deleted successfully'})

@app.route('/api/players/<player_name>/update', methods=['POST'])
def update_player(player_name):
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.get_json()
    uid = session['uid']
    new_name = data.get('new_name', '').strip()
    new_role = data.get('new_role')
    
    if not new_name:
        return jsonify({'success': False, 'message': 'Player name cannot be empty'})
    
    # Delete old player and create new one with updated info
    delete_player(db, uid, player_name)
    success, message = save_player(db, uid, new_name, new_role)
    
    return jsonify({'success': success, 'message': 'Player updated successfully' if success else 'Error updating player'})

@app.route('/api/matches/<player_name>', methods=['GET'])
def get_matches(player_name):
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    uid = session['uid']
    matches_df = fetch_matches(db, uid, player_name)
    matches_data = matches_df.to_dict('index') if not matches_df.empty else {}
    
    return jsonify({'success': True, 'matches': matches_data})

@app.route('/api/matches', methods=['POST'])
def add_match():
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.get_json()
    uid = session['uid']
    player_name = data.get('player_name')
    match_id = data.get('match_id', '').strip()
    
    if not match_id:
        return jsonify({'success': False, 'message': 'Match ID cannot be empty'})
    
    # Get player role
    df = fetch_players(db, uid)
    if player_name not in df.index:
        return jsonify({'success': False, 'message': 'Player not found'})
    
    role = df.loc[player_name]['role']
    
    # Extract match data
    runs = int(data.get('runs', 0))
    wickets = int(data.get('wickets', 0))
    catches = int(data.get('catches', 0))
    balls_faced = int(data.get('balls_faced', 0))
    fours = int(data.get('fours', 0))
    sixes = int(data.get('sixes', 0))
    balls_bowled = int(data.get('balls_bowled', 0))
    dot_balls = int(data.get('dot_balls', 0))
    
    # Calculate metrics
    strike_rate = round((runs / balls_faced * 100), 2) if balls_faced > 0 else 0
    economy = round((runs / (balls_bowled / 6)), 2) if balls_bowled > 0 else 0
    
    # Calculate efficiency based on role
    if role == "Batsman":
        efficiency = (
            1.0 * runs +
            4.0 * fours +
            6.0 * sixes +
            0.6 * strike_rate -
            0.5 * dot_balls +
            10.0 * catches +
            15.0 * wickets -
            1.5 * economy
        )
    elif role == "Bowler":
        efficiency = (
            0.5 * runs +
            2.0 * fours +
            3.0 * sixes +
            0.2 * strike_rate -
            0.3 * dot_balls +
            10.0 * catches +
            25.0 * wickets -
            3.0 * economy
        )
    else:  # All-Rounder
        efficiency = (
            1.0 * runs +
            4.0 * fours +
            6.0 * sixes +
            0.5 * strike_rate -
            0.4 * dot_balls +
            10.0 * catches +
            20.0 * wickets -
            2.0 * economy
        )
    
    success, message = save_match(db, uid, player_name, match_id, 
                                runs, wickets, catches, balls_faced, 
                                fours, sixes, balls_bowled, dot_balls, 
                                strike_rate, economy, efficiency)
    
    return jsonify({'success': success, 'message': message})

@app.route('/api/matches/<player_name>/<match_id>', methods=['DELETE'])
def remove_match(player_name, match_id):
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    uid = session['uid']
    delete_match(db, uid, player_name, match_id)
    return jsonify({'success': True, 'message': 'Match deleted successfully'})

@app.route('/api/team-results')
def team_results():
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    uid = session['uid']
    df = fetch_players(db, uid)
    
    if df.empty:
        return jsonify({'success': True, 'players': []})
    
    # Fill NaN values and sort by efficiency
    df = df.fillna({"total_runs": 0, "total_wickets": 0, "total_catches": 0, "efficiency": 0})
    df = df.sort_values(by="efficiency", ascending=False).head(11)
    
    # Convert to list of dictionaries for JSON
    players_list = []
    for name, data in df.iterrows():
        players_list.append({
            'name': name,
            'role': data['role'],
            'efficiency': data['efficiency'],
            'total_runs': data['total_runs'],
            'total_wickets': data['total_wickets'],
            'total_catches': data['total_catches']
        })
    
    return jsonify({'success': True, 'players': players_list})

if __name__ == '__main__':
    app.run(debug=True)
