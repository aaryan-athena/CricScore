import json
import pandas as pd

# Fetch all players for the coach
def fetch_players(db, uid):
    data = db.child("coach_data").child(uid).child("players").get().val() or {}
    if isinstance(data, list):
        data = {str(i): v for i, v in enumerate(data)}
    cleaned = {
        name: {
            "role": player.get("role", ""),
            "efficiency": player.get("efficiency", 0),
            "total_runs": player.get("total_runs", 0),
            "total_wickets": player.get("total_wickets", 0),
            "total_catches": player.get("total_catches", 0),
            "total_missed_catches": player.get("total_missed_catches", 0),
            "total_missed_catches_batsman": player.get("total_missed_catches_batsman", 0),
            "total_missed_catches_bowler": player.get("total_missed_catches_bowler", 0),
            "total_overthrows": player.get("total_overthrows", 0),
            "total_misfields": player.get("total_misfields", 0),
        } for name, player in data.items()
    }
    df = pd.DataFrame.from_dict(cleaned, orient='index')
    df.index.name = 'name'
    return df

# Save a new player (only if not exists)
def save_player(db, uid, name, role):
    existing = db.child("coach_data").child(uid).child("players").child(name).get().val()
    if existing:
        return False, "Player with this name already exists."

    db.child("coach_data").child(uid).child("players").child(name).set({
        "role": role,
        "efficiency": 0,
        "total_runs": 0,
        "total_wickets": 0,
        "total_catches": 0,
        "total_missed_catches": 0,
        "total_missed_catches_batsman": 0,
        "total_missed_catches_bowler": 0,
        "total_overthrows": 0,
        "total_misfields": 0
    })
    return True, "Player added."

# Save a new match entry for a player
def save_match(db, uid, name, match_id, runs, wickets, catches, missed_catches, missed_catches_batsman, missed_catches_bowler, overthrows, misfields, balls_faced, fours, sixes, balls_bowled, dot_balls, runs_conceded, strike_rate, economy, efficiency):
    match_exists = db.child("coach_data").child(uid).child("players").child(name).child("matches").child(match_id).get().val()
    if match_exists:
        return False, "Match ID already exists for this player."

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
    
    db.child("coach_data").child(uid).child("players").child(name).child("matches").child(match_id).set(match_data)

    # Recalculate player totals from all matches
    all_matches = db.child("coach_data").child(uid).child("players").child(name).child("matches").get().val()
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

    db.child("coach_data").child(uid).child("players").child(name).update({
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
    
    return True, "Match added successfully."

# Delete a player completely
def delete_player(db, uid, name):
    db.child("coach_data").child(uid).child("players").child(name).remove()

# Fetch all matches for a player
def fetch_matches(db, uid, name):
    data = db.child("coach_data").child(uid).child("players").child(name).child("matches").get().val() or {}

    if isinstance(data, list):
        data = {str(i): v for i, v in enumerate(data)}

    cleaned_data = {}
    for k, v in data.items():
        if isinstance(v, str):
            try:
                v = json.loads(v.replace("'", "\""))
            except:
                continue
        if isinstance(v, dict):
            cleaned_data[k] = v

    df = pd.DataFrame.from_dict(cleaned_data, orient='index')
    df.index.name = 'match_id'
    return df

# Delete a specific match entry
def delete_match(db, uid, name, match_id):
    db.child("coach_data").child(uid).child("players").child(name).child("matches").child(match_id).remove()

# Update a specific match entry
def update_match(db, uid, name, match_id, runs, wickets, catches, missed_catches, misfields, balls_faced, fours, sixes, balls_bowled, dot_balls, runs_conceded, strike_rate, economy, efficiency):
    match_data = {
        "runs": runs,
        "wickets": wickets,
        "catches": catches,
        "missed_catches": missed_catches,
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
    
    db.child("coach_data").child(uid).child("players").child(name).child("matches").child(match_id).set(match_data)

    # Recalculate player totals from all matches
    all_matches = db.child("coach_data").child(uid).child("players").child(name).child("matches").get().val()
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
    total_misfields = sum(m.get("misfields", 0) for m in valid_matches)
    avg_eff = total_eff / len(valid_matches) if valid_matches else 0

    db.child("coach_data").child(uid).child("players").child(name).update({
        "efficiency": round(avg_eff, 2),
        "total_runs": total_runs,
        "total_wickets": total_wickets,
        "total_catches": total_catches,
        "total_missed_catches": total_missed_catches,
        "total_misfields": total_misfields
    })
    
    return True, "Match updated successfully."
