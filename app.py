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
    missed_catches = int(data.get('missed_catches', 0))
    misfields = int(data.get('misfields', 0))
    balls_faced = int(data.get('balls_faced', 0))
    fours = int(data.get('fours', 0))
    sixes = int(data.get('sixes', 0))
    balls_bowled = int(data.get('balls_bowled', 0))
    dot_balls = int(data.get('dot_balls', 0))
    runs_conceded = int(data.get('runs_conceded', 0))
    
    # Calculate metrics
    strike_rate = round((runs / balls_faced * 100), 2) if balls_faced > 0 else 0
    economy = round((runs_conceded / (balls_bowled / 6)), 2) if balls_bowled > 0 else 0
    
    # Calculate efficiency based on role with improved formulas
    if role == "Batsman":
        # Emphasize batting stats for batsmen
        efficiency = (
            2.0 * runs +                    # Higher weight for runs
            6.0 * fours +                   # Higher weight for boundaries
            8.0 * sixes +                   # Higher weight for sixes
            1.2 * strike_rate +             # Strong emphasis on strike rate
            8.0 * catches +                 # Fielding contribution
            12.0 * wickets +                # Bonus for bowling wickets
            -3.0 * missed_catches +         # Penalty for missed catches
            -2.0 * misfields +              # Penalty for misfields
            -1.0 * dot_balls +              # Penalty for dot balls
            -0.5 * economy +                # Minor penalty for economy (when bowling)
            4.0 * missed_catches_batsman +  # Bonus for batsman when catches missed
            -1.0 * missed_catches_bowler +  # Minor penalty when bowler affected by drops
            -0.5 * overthrows               # Minor penalty for overthrows
        )
    elif role == "Bowler":
        # Emphasize bowling stats for bowlers
        efficiency = (
            0.8 * runs +                    # Lower weight for batting runs
            2.0 * fours +                   # Lower weight for batting boundaries
            3.0 * sixes +                   # Lower weight for batting sixes
            0.3 * strike_rate +             # Minor batting contribution
            8.0 * catches +                 # Good fielding contribution
            30.0 * wickets +                # Very high weight for wickets
            -5.0 * missed_catches +         # Higher penalty for missed catches
            -3.0 * misfields +              # Higher penalty for misfields
            -0.5 * dot_balls +              # Minor penalty for dot balls when batting
            -4.0 * economy +                # Strong penalty for high economy rate
            -2.0 * missed_catches_batsman + # Penalty when batsman benefits from drops
            -8.0 * missed_catches_bowler +  # Major penalty when bowler affected by drops
            -3.0 * overthrows               # Penalty for overthrows conceded
        )
    else:  # All-Rounder
        # Balanced weight for both batting and bowling
        efficiency = (
            1.5 * runs +                    # Balanced weight for runs
            5.0 * fours +                   # Balanced weight for boundaries
            6.0 * sixes +                   # Balanced weight for sixes
            0.8 * strike_rate +             # Balanced strike rate importance
            8.0 * catches +                 # Fielding contribution
            22.0 * wickets +                # Balanced weight for wickets
            -4.0 * missed_catches +         # Penalty for missed catches
            -2.5 * misfields +              # Penalty for misfields
            -0.8 * dot_balls +              # Penalty for dot balls
            -2.5 * economy +                # Balanced penalty for economy
            1.0 * missed_catches_batsman +  # Small bonus when batting benefits
            -4.0 * missed_catches_bowler +  # Penalty when bowling affected by drops
            -2.0 * overthrows               # Penalty for overthrows
        )
    
    success, message = save_match(db, uid, player_name, match_id, 
                                runs, wickets, catches, missed_catches, misfields,
                                missed_catches_batsman, missed_catches_bowler, overthrows,
                                balls_faced, fours, sixes, balls_bowled, dot_balls, 
                                runs_conceded, strike_rate, economy, efficiency)
    
    return jsonify({'success': success, 'message': message})

@app.route('/api/matches/<player_name>/<match_id>', methods=['PUT'])
def update_match(player_name, match_id):
    if 'logged_in' not in session or not session['logged_in']:
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.get_json()
    uid = session['uid']
    
    # Get player role
    df = fetch_players(db, uid)
    if player_name not in df.index:
        return jsonify({'success': False, 'message': 'Player not found'})
    
    role = df.loc[player_name]['role']
    
    # Extract match data
    runs = int(data.get('runs', 0))
    wickets = int(data.get('wickets', 0))
    catches = int(data.get('catches', 0))
    missed_catches = int(data.get('missed_catches', 0))
    missed_catches_batsman = int(data.get('missed_catches_batsman', 0))
    missed_catches_bowler = int(data.get('missed_catches_bowler', 0))
    overthrows = int(data.get('overthrows', 0))
    misfields = int(data.get('misfields', 0))
    balls_faced = int(data.get('balls_faced', 0))
    fours = int(data.get('fours', 0))
    sixes = int(data.get('sixes', 0))
    balls_bowled = int(data.get('balls_bowled', 0))
    dot_balls = int(data.get('dot_balls', 0))
    runs_conceded = int(data.get('runs_conceded', 0))
    
    # Calculate metrics
    strike_rate = round((runs / balls_faced * 100), 2) if balls_faced > 0 else 0
    economy = round((runs_conceded / (balls_bowled / 6)), 2) if balls_bowled > 0 else 0
    
    # Calculate efficiency based on role with improved formulas
    if role == "Batsman":
        # Emphasize batting stats for batsmen
        efficiency = (
            2.0 * runs +                    # Higher weight for runs
            6.0 * fours +                   # Higher weight for boundaries
            8.0 * sixes +                   # Higher weight for sixes
            1.2 * strike_rate +             # Strong emphasis on strike rate
            8.0 * catches +                 # Fielding contribution
            12.0 * wickets +                # Bonus for bowling wickets
            -3.0 * missed_catches +         # Penalty for missed catches
            -4.0 * missed_catches_batsman + # Higher penalty for batsman perspective missed catches
            -2.0 * missed_catches_bowler +  # Lower penalty for bowler perspective missed catches
            -3.0 * overthrows +             # Penalty for overthrows
            -2.0 * misfields +              # Penalty for misfields
            -1.0 * dot_balls +              # Penalty for dot balls
            -0.5 * economy                  # Minor penalty for economy (when bowling)
        )
    elif role == "Bowler":
        # Emphasize bowling stats for bowlers
        efficiency = (
            0.8 * runs +                    # Lower weight for batting runs
            2.0 * fours +                   # Lower weight for batting boundaries
            3.0 * sixes +                   # Lower weight for batting sixes
            0.3 * strike_rate +             # Minor batting contribution
            8.0 * catches +                 # Good fielding contribution
            30.0 * wickets +                # Very high weight for wickets
            -5.0 * missed_catches +         # Higher penalty for missed catches
            -2.0 * missed_catches_batsman + # Lower penalty for batsman perspective missed catches
            -6.0 * missed_catches_bowler +  # Higher penalty for bowler perspective missed catches
            -5.0 * overthrows +             # Higher penalty for overthrows (bowling perspective)
            -3.0 * misfields +              # Higher penalty for misfields
            -0.5 * dot_balls +              # Minor penalty for dot balls when batting
            -4.0 * economy                  # Strong penalty for high economy rate
        )
    else:  # All-Rounder
        # Balanced weight for both batting and bowling
        efficiency = (
            1.5 * runs +                    # Balanced weight for runs
            5.0 * fours +                   # Balanced weight for boundaries
            6.0 * sixes +                   # Balanced weight for sixes
            0.8 * strike_rate +             # Balanced strike rate importance
            8.0 * catches +                 # Fielding contribution
            22.0 * wickets +                # Balanced weight for wickets
            -4.0 * missed_catches +         # Penalty for missed catches
            -3.0 * missed_catches_batsman + # Balanced penalty for batsman perspective missed catches
            -4.0 * missed_catches_bowler +  # Balanced penalty for bowler perspective missed catches
            -4.0 * overthrows +             # Balanced penalty for overthrows
            -2.5 * misfields +              # Penalty for misfields
            -0.8 * dot_balls +              # Penalty for dot balls
            -2.5 * economy                  # Balanced penalty for economy
        )
    
    # Update the match record
    match_data = {
        "runs": runs,
        "wickets": wickets,
        "catches": catches,
        "missed_catches": missed_catches,
        "missed_catches_batsman": missed_catches_batsman,
        "missed_catches_bowler": missed_catches_bowler,
        "overthrows": overthrows,
        "misfields": misfields,
        "balls_faced": balls_faced,
        "fours": fours,
        "sixes": sixes,
        "balls_bowled": balls_bowled,
        "dot_balls": dot_balls,
        "runs_conceded": runs_conceded,
        "strike_rate": strike_rate,
        "economy": economy,
        "efficiency": efficiency
    }
    
    db.child("coach_data").child(uid).child("players").child(player_name).child("matches").child(match_id).set(match_data)
    
    # Recalculate player totals from all matches (similar to save_match function)
    from players import save_match
    # We'll use the existing logic from players.py by calling a helper function
    # For now, let's implement the recalculation here
    all_matches = db.child("coach_data").child(uid).child("players").child(player_name).child("matches").get().val()
    if isinstance(all_matches, list):
        all_matches = {str(i): match for i, match in enumerate(all_matches)}

    valid_matches = []
    for m in all_matches.values():
        if isinstance(m, str):
            try:
                m = json.loads(m.replace("'", "\""))
            except:
                continue
        if isinstance(m, dict):
            valid_matches.append(m)

    total_eff = sum(m.get("efficiency", 0) for m in valid_matches)
    total_runs = sum(m.get("runs", 0) for m in valid_matches)
    total_wickets = sum(m.get("wickets", 0) for m in valid_matches)
    total_catches = sum(m.get("catches", 0) for m in valid_matches)
    total_missed_catches = sum(m.get("missed_catches", 0) for m in valid_matches)
    total_missed_catches_batsman = sum(m.get("missed_catches_batsman", 0) for m in valid_matches)
    total_missed_catches_bowler = sum(m.get("missed_catches_bowler", 0) for m in valid_matches)
    total_overthrows = sum(m.get("overthrows", 0) for m in valid_matches)
    total_misfields = sum(m.get("misfields", 0) for m in valid_matches)
    avg_eff = total_eff / len(valid_matches) if valid_matches else 0

    db.child("coach_data").child(uid).child("players").child(player_name).update({
        "efficiency": round(avg_eff, 2),
        "total_runs": total_runs,
        "total_wickets": total_wickets,
        "total_catches": total_catches,
        "total_missed_catches": total_missed_catches,
        "total_missed_catches_batsman": total_missed_catches_batsman,
        "total_missed_catches_bowler": total_missed_catches_bowler,
        "total_overthrows": total_overthrows,
        "total_misfields": total_misfields
    })
    
    return jsonify({'success': True, 'message': 'Match updated successfully'})

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
    df = df.fillna({
        "total_runs": 0, 
        "total_wickets": 0, 
        "total_catches": 0, 
        "total_missed_catches": 0,
        "total_misfields": 0,
        "efficiency": 0
    })
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
            'total_catches': data['total_catches'],
            'total_missed_catches': data['total_missed_catches'],
            'total_misfields': data['total_misfields']
        })
    
    return jsonify({'success': True, 'players': players_list})

if __name__ == '__main__':
    app.run(debug=True)
