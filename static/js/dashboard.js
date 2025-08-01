// Dashboard functionality
let currentPlayers = {};
let currentMatches = {};
let charts = {};
let currentView = 'summary';

document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPage = item.dataset.page;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `${targetPage}-page`) {
                    page.classList.add('active');
                    
                    // Load page-specific data
                    switch (targetPage) {
                        case 'players':
                            loadPlayers();
                            break;
                        case 'results':
                            loadTeamResults();
                            break;
                        case 'analytics':
                            loadAnalytics();
                            break;
                    }
                }
            });
        });
    });
    
    // Load initial data
    loadPlayers();
    setupEventListeners();
});

function setupEventListeners() {
    // Add player form
    const addPlayerForm = document.getElementById('addPlayerForm');
    addPlayerForm.addEventListener('submit', handleAddPlayer);
    
    // Edit player form
    const editPlayerForm = document.getElementById('editPlayerForm');
    editPlayerForm.addEventListener('submit', handleEditPlayer);
    
    // Add match form
    const addMatchForm = document.getElementById('addMatchForm');
    addMatchForm.addEventListener('submit', handleAddMatch);
    
    // Edit match form
    const editMatchForm = document.getElementById('editMatchForm');
    editMatchForm.addEventListener('submit', handleEditMatch);
    
    // Edit match select
    const editMatchSelect = document.getElementById('edit-match-select');
    if (editMatchSelect) {
        editMatchSelect.addEventListener('change', handleMatchSelection);
    }
    
    // Role filter for results
    const roleFilter = document.getElementById('role-filter');
    if (roleFilter) {
        roleFilter.addEventListener('change', loadTeamResults);
    }
    
    // Analytics player select
    const analyticsSelect = document.getElementById('analytics-player-select');
    if (analyticsSelect) {
        analyticsSelect.addEventListener('change', handlePlayerSelection);
    }

    // Time period buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-btn')) {
            handleViewChange(e.target);
        }
    });
}

async function loadPlayers() {
    try {
        const response = await makeRequest('/api/players');
        if (response.success) {
            currentPlayers = response.players;
            renderPlayers();
            updateAnalyticsSelect();
        }
    } catch (error) {
        showNotification('Failed to load players', 'error');
    }
}

function renderPlayers() {
    const playersGrid = document.getElementById('players-list');
    
    if (Object.keys(currentPlayers).length === 0) {
        playersGrid.innerHTML = '<p class="no-data">No players found. Add some players to get started.</p>';
        return;
    }
    
    playersGrid.innerHTML = Object.entries(currentPlayers).map(([name, player]) => `
        <div class="player-card">
            <div class="player-info">
                <h4>${name}</h4>
                <span class="player-role">${player.role}</span>
            </div>
            <div class="player-stats">
                <div class="stat-item">
                    <div class="stat-value">${formatNumber(player.efficiency)}</div>
                    <div class="stat-label">Efficiency</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.total_runs || 0}</div>
                    <div class="stat-label">Runs</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.total_wickets || 0}</div>
                    <div class="stat-label">Wickets</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.total_catches || 0}</div>
                    <div class="stat-label">Catches</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.total_missed_catches || 0}</div>
                    <div class="stat-label">Missed Catches</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${player.total_misfields || 0}</div>
                    <div class="stat-label">Misfields</div>
                </div>
            </div>
            <div class="player-actions">
                <button class="btn btn-success" onclick="openAddMatchModal('${name}')">
                    <i class="fas fa-plus"></i> Add Match
                </button>
                <button class="btn btn-info" onclick="openEditMatchModal('${name}')">
                    <i class="fas fa-edit"></i> Edit Match
                </button>
                <button class="btn btn-primary" onclick="openEditPlayerModal('${name}', '${player.role}')">
                    <i class="fas fa-user-edit"></i> Edit Player
                </button>
                <button class="btn btn-danger" onclick="deletePlayer('${name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function handleAddPlayer(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        role: formData.get('role')
    };
    
    try {
        const response = await makeRequest('/api/players', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            e.target.reset();
            loadPlayers();
        } else {
            showNotification(response.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to add player', 'error');
    }
}

function openEditPlayerModal(playerName, playerRole) {
    document.getElementById('edit-player-original').value = playerName;
    document.getElementById('edit-player-name').value = playerName;
    document.getElementById('edit-player-role').value = playerRole;
    openModal('editPlayerModal');
}

async function handleEditPlayer(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const originalName = formData.get('original_name');
    const data = {
        new_name: formData.get('new_name'),
        new_role: formData.get('new_role')
    };
    
    try {
        const response = await makeRequest(`/api/players/${originalName}/update`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            closeModal();
            loadPlayers();
        } else {
            showNotification(response.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to update player', 'error');
    }
}

async function deletePlayer(playerName) {
    if (!confirm(`Are you sure you want to delete ${playerName}?`)) {
        return;
    }
    
    try {
        const response = await makeRequest(`/api/players/${playerName}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            loadPlayers();
        }
    } catch (error) {
        showNotification('Failed to delete player', 'error');
    }
}

function openAddMatchModal(playerName) {
    document.getElementById('match-player-name').value = playerName;
    document.querySelector('#addMatchModal .modal-header h3').textContent = `Add Match Record - ${playerName}`;
    
    openModal('addMatchModal');
}

async function openEditMatchModal(playerName) {
    document.getElementById('edit-match-player-name').value = playerName;
    document.querySelector('#editMatchModal .modal-header h3').textContent = `Edit Match Record - ${playerName}`;
    
    // Load existing matches for the player
    try {
        const response = await makeRequest(`/api/matches/${encodeURIComponent(playerName)}`);
        if (response.success) {
            const matchSelect = document.getElementById('edit-match-select');
            matchSelect.innerHTML = '<option value="">Select a match...</option>';
            
            Object.keys(response.matches).forEach(matchId => {
                const option = document.createElement('option');
                option.value = matchId;
                option.textContent = matchId;
                matchSelect.appendChild(option);
            });
            
            // Store matches data for form population
            window.currentMatches = response.matches;
            
            openModal('editMatchModal');
        } else {
            showNotification('Failed to load matches', 'error');
        }
    } catch (error) {
        showNotification('Failed to load matches', 'error');
    }
}

async function handleAddMatch(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        player_name: formData.get('player_name'),
        match_id: formData.get('match_id'),
        runs: parseInt(formData.get('runs')),
        wickets: parseInt(formData.get('wickets')),
        catches: parseInt(formData.get('catches')),
        missed_catches: parseInt(formData.get('missed_catches')),
        misfields: parseInt(formData.get('misfields')),
        balls_faced: parseInt(formData.get('balls_faced')),
        fours: parseInt(formData.get('fours')),
        sixes: parseInt(formData.get('sixes')),
        balls_bowled: parseInt(formData.get('balls_bowled')),
        dot_balls: parseInt(formData.get('dot_balls')),
        runs_conceded: parseInt(formData.get('runs_conceded'))
    };
    
    try {
        const response = await makeRequest('/api/matches', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            closeModal();
            e.target.reset();
            loadPlayers();
        } else {
            showNotification(response.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to add match', 'error');
    }
}

function handleMatchSelection(e) {
    const selectedMatchId = e.target.value;
    if (selectedMatchId && window.currentMatches && window.currentMatches[selectedMatchId]) {
        const matchData = window.currentMatches[selectedMatchId];
        
        // Populate the form with existing match data
        document.getElementById('edit-match-original-id').value = selectedMatchId;
        document.getElementById('edit-match-runs').value = matchData.runs || 0;
        document.getElementById('edit-match-wickets').value = matchData.wickets || 0;
        document.getElementById('edit-match-catches').value = matchData.catches || 0;
        document.getElementById('edit-match-missed-catches').value = matchData.missed_catches || 0;
        document.getElementById('edit-match-misfields').value = matchData.misfields || 0;
        document.getElementById('edit-match-balls-faced').value = matchData.balls_faced || 0;
        document.getElementById('edit-match-fours').value = matchData.fours || 0;
        document.getElementById('edit-match-sixes').value = matchData.sixes || 0;
        document.getElementById('edit-match-balls-bowled').value = matchData.balls_bowled || 0;
        document.getElementById('edit-match-dot-balls').value = matchData.dot_balls || 0;
        document.getElementById('edit-match-runs-conceded').value = matchData.runs_conceded || 0;
    } else {
        // Clear the form if no match selected
        document.getElementById('edit-match-original-id').value = '';
        document.getElementById('edit-match-runs').value = 0;
        document.getElementById('edit-match-wickets').value = 0;
        document.getElementById('edit-match-catches').value = 0;
        document.getElementById('edit-match-missed-catches').value = 0;
        document.getElementById('edit-match-misfields').value = 0;
        document.getElementById('edit-match-balls-faced').value = 0;
        document.getElementById('edit-match-fours').value = 0;
        document.getElementById('edit-match-sixes').value = 0;
        document.getElementById('edit-match-balls-bowled').value = 0;
        document.getElementById('edit-match-dot-balls').value = 0;
        document.getElementById('edit-match-runs-conceded').value = 0;
    }
}

async function handleEditMatch(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const playerName = formData.get('player_name');
    const originalMatchId = formData.get('original_match_id');
    const selectedMatchId = formData.get('match_id');
    
    if (!selectedMatchId) {
        showNotification('Please select a match to edit', 'error');
        return;
    }
    
    const data = {
        runs: parseInt(formData.get('runs')),
        wickets: parseInt(formData.get('wickets')),
        catches: parseInt(formData.get('catches')),
        missed_catches: parseInt(formData.get('missed_catches')),
        misfields: parseInt(formData.get('misfields')),
        balls_faced: parseInt(formData.get('balls_faced')),
        fours: parseInt(formData.get('fours')),
        sixes: parseInt(formData.get('sixes')),
        balls_bowled: parseInt(formData.get('balls_bowled')),
        dot_balls: parseInt(formData.get('dot_balls')),
        runs_conceded: parseInt(formData.get('runs_conceded'))
    };
    
    try {
        const response = await makeRequest(`/api/matches/${encodeURIComponent(playerName)}/${encodeURIComponent(selectedMatchId)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            closeModal();
            e.target.reset();
            loadPlayers();
        } else {
            showNotification(response.message, 'error');
        }
    } catch (error) {
        showNotification('Failed to update match', 'error');
    }
}

async function loadTeamResults() {
    try {
        const response = await makeRequest('/api/team-results');
        if (response.success) {
            renderTeamResults(response.players);
        }
    } catch (error) {
        showNotification('Failed to load team results', 'error');
    }
}

function renderTeamResults(players) {
    const resultsTable = document.getElementById('results-table');
    
    if (players.length === 0) {
        resultsTable.innerHTML = '<p class="no-data">No players found. Add some players to see results.</p>';
        return;
    }
    
    // Filter by role
    const roleFilter = document.getElementById('role-filter').value;
    let filteredPlayers = players;
    
    if (roleFilter !== 'All') {
        filteredPlayers = players.filter(player => player.role === roleFilter);
    }
    
    const tableHTML = `
        <div class="results-table">
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player Name</th>
                        <th>Role</th>
                        <th>Efficiency</th>
                        <th>Total Runs</th>
                        <th>Total Wickets</th>
                        <th>Total Catches</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredPlayers.map((player, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${player.name}</td>
                            <td>${player.role}</td>
                            <td>${formatNumber(player.efficiency)}</td>
                            <td>${player.total_runs}</td>
                            <td>${player.total_wickets}</td>
                            <td>${player.total_catches}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultsTable.innerHTML = tableHTML;
}

function updateAnalyticsSelect() {
    const select = document.getElementById('analytics-player-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a player...</option>';
    
    Object.keys(currentPlayers).forEach(playerName => {
        const option = document.createElement('option');
        option.value = playerName;
        option.textContent = playerName;
        select.appendChild(option);
    });
}

async function loadAnalytics() {
    updateAnalyticsSelect();
}

async function loadPlayerAnalytics() {
    const select = document.getElementById('analytics-player-select');
    const playerName = select.value;
    
    if (!playerName) {
        document.getElementById('player-stats').innerHTML = '';
        document.getElementById('player-matches').innerHTML = '';
        document.getElementById('player-charts').innerHTML = '';
        return;
    }
    
    try {
        // Load player stats
        const player = currentPlayers[playerName];
        renderPlayerStats(player, playerName);
        
        // Load player matches
        const matchesResponse = await makeRequest(`/api/matches/${playerName}`);
        if (matchesResponse.success) {
            currentMatches = matchesResponse.matches;
            renderPlayerMatches(matchesResponse.matches, playerName);
            renderPlayerCharts(matchesResponse.matches);
        }
    } catch (error) {
        showNotification('Failed to load player analytics', 'error');
    }
}

function renderPlayerStats(player, playerName) {
    const statsGrid = document.getElementById('player-stats');
    
    statsGrid.innerHTML = `
        <div class="stats-card">
            <div class="stat-value">${player.role}</div>
            <div class="stat-label">Role</div>
        </div>
        <div class="stats-card">
            <div class="stat-value">${formatNumber(player.efficiency)}</div>
            <div class="stat-label">Efficiency</div>
        </div>
        <div class="stats-card">
            <div class="stat-value">${player.total_runs || 0}</div>
            <div class="stat-label">Total Runs</div>
        </div>
        <div class="stats-card">
            <div class="stat-value">${player.total_wickets || 0}</div>
            <div class="stat-label">Total Wickets</div>
        </div>
        <div class="stats-card">
            <div class="stat-value">${player.total_catches || 0}</div>
            <div class="stat-label">Total Catches</div>
        </div>
    `;
}

function renderPlayerMatches(matches, playerName) {
    const matchesSection = document.getElementById('player-matches');
    
    if (Object.keys(matches).length === 0) {
        matchesSection.innerHTML = '<h3>Match-wise Performance</h3><p class="no-data">No match data found for this player.</p>';
        return;
    }
    
    const tableHTML = `
        <h3>Match-wise Performance</h3>
        <div class="matches-table">
            <table>
                <thead>
                    <tr>
                        <th>Match ID</th>
                        <th>Runs</th>
                        <th>Wickets</th>
                        <th>Catches</th>
                        <th>Strike Rate</th>
                        <th>Economy</th>
                        <th>Efficiency</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(matches).map(([matchId, match]) => `
                        <tr>
                            <td>${matchId}</td>
                            <td>${match.runs || 0}</td>
                            <td>${match.wickets || 0}</td>
                            <td>${match.catches || 0}</td>
                            <td>${formatNumber(match.strike_rate)}</td>
                            <td>${formatNumber(match.economy)}</td>
                            <td>${formatNumber(match.efficiency)}</td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="deleteMatch('${playerName}', '${matchId}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    matchesSection.innerHTML = tableHTML;
}

function renderPlayerCharts(matches) {
    const chartsSection = document.getElementById('player-charts');
    
    if (Object.keys(matches).length === 0) {
        chartsSection.innerHTML = '';
        return;
    }
    
    // Simple text-based charts for now
    const chartData = Object.entries(matches).map(([matchId, match]) => ({
        matchId,
        runs: match.runs || 0,
        wickets: match.wickets || 0,
        catches: match.catches || 0,
        efficiency: match.efficiency || 0
    }));
    
    chartsSection.innerHTML = `
        <h3>Performance Trends</h3>
        <div class="chart-container">
            <div class="chart-title">Recent Match Performance</div>
            <div class="simple-chart">
                ${chartData.map(data => `
                    <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                        <span>${data.matchId}</span>
                        <span>Runs: ${data.runs} | Wickets: ${data.wickets} | Efficiency: ${formatNumber(data.efficiency)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function deleteMatch(playerName, matchId) {
    if (!confirm(`Are you sure you want to delete match ${matchId}?`)) {
        return;
    }
    
    try {
        const response = await makeRequest(`/api/matches/${playerName}/${matchId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification(response.message, 'success');
            loadPlayerAnalytics();
            loadPlayers(); // Refresh player stats
        }
    } catch (error) {
        showNotification('Failed to delete match', 'error');
    }
}

// Enhanced Analytics Functions
function handlePlayerSelection() {
    const selectedPlayer = document.getElementById('analytics-player-select').value;
    
    if (selectedPlayer) {
        document.getElementById('view-toggle-section').style.display = 'block';
        loadPlayerAnalytics();
    } else {
        hideAnalyticsSections();
    }
}

function handleViewChange(button) {
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    currentView = button.dataset.view;
    updateAnalyticsView();
}

function hideAnalyticsSections() {
    document.getElementById('view-toggle-section').style.display = 'none';
    document.getElementById('player-stats').style.display = 'none';
    document.getElementById('player-charts').style.display = 'none';
    document.getElementById('player-matches').style.display = 'none';
    document.getElementById('performance-trends').style.display = 'none';
}

async function loadPlayerAnalytics() {
    const selectedPlayer = document.getElementById('analytics-player-select').value;
    if (!selectedPlayer) return;

    try {
        const response = await makeRequest(`/api/matches/${selectedPlayer}`);
        if (response.success) {
            currentMatches = response.matches;
            updateAnalyticsView();
        }
    } catch (error) {
        showNotification('Failed to load player analytics', 'error');
    }
}

function updateAnalyticsView() {
    const selectedPlayer = document.getElementById('analytics-player-select').value;
    if (!selectedPlayer) return;
    
    switch (currentView) {
        case 'summary':
            showSummaryStats(selectedPlayer, currentMatches);
            break;
        case 'match':
            showMatchAnalysis(selectedPlayer, currentMatches);
            break;
        case 'trends':
            showTrendsAnalysis(selectedPlayer, currentMatches);
            break;
    }
}

function showSummaryStats(playerName, matches) {
    // Hide all sections first
    document.getElementById('player-stats').style.display = 'none';
    document.getElementById('player-charts').style.display = 'none';
    document.getElementById('player-matches').style.display = 'none';
    
    // Clear content in other sections (but not charts section which has static HTML)
    document.getElementById('matches-table-container').innerHTML = '';
    
    const player = currentPlayers[playerName];
    const stats = calculatePlayerStats(matches);
    
    // Show and populate summary stats
    document.getElementById('player-stats').style.display = 'block';
    document.getElementById('player-stats').innerHTML = `
        <div class="stat-card">
            <span class="stat-value">${stats.totalRuns}</span>
            <span class="stat-label">Total Runs</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${stats.totalWickets}</span>
            <span class="stat-label">Total Wickets</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${stats.totalCatches}</span>
            <span class="stat-label">Total Catches</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${stats.avgEfficiency.toFixed(1)}</span>
            <span class="stat-label">Avg Efficiency</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${stats.strikeRate.toFixed(1)}</span>
            <span class="stat-label">Strike Rate</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${stats.economy.toFixed(2)}</span>
            <span class="stat-label">Economy Rate</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${Object.keys(matches).length}</span>
            <span class="stat-label">Total Matches</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${calculateTotalBoundaries(matches)}</span>
            <span class="stat-label">Total Boundaries</span>
        </div>
    `;
}

function showMatchAnalysis(playerName, matches) {
    // Hide all sections first
    document.getElementById('player-stats').style.display = 'none';
    document.getElementById('player-charts').style.display = 'none';
    document.getElementById('player-matches').style.display = 'none';
    
    // Clear content in other sections (but not charts section which has static HTML)
    document.getElementById('player-stats').innerHTML = '';
    
    // Show and populate match analysis
    document.getElementById('player-matches').style.display = 'block';
    renderMatchTable(matches);
}

function showTrendsAnalysis(playerName, matches) {
    // Hide other sections first
    document.getElementById('player-stats').style.display = 'none';
    document.getElementById('player-matches').style.display = 'none';
    
    // Clear content in other sections
    document.getElementById('player-stats').innerHTML = '';
    document.getElementById('matches-table-container').innerHTML = '';
    
    // Show both original charts and performance trends sections
    document.getElementById('player-charts').style.display = 'block';
    document.getElementById('performance-trends').style.display = 'block';
    
    // Render both types of charts
    const stats = calculatePlayerStats(matches);
    renderPerformanceCharts(playerName, matches, stats);
    renderPerformanceTrends(playerName, matches);
}

function calculateTotalBoundaries(matches) {
    const matchArray = Object.values(matches);
    return matchArray.reduce((total, match) => {
        return total + (match.fours || 0) + (match.sixes || 0);
    }, 0);
}

function calculatePlayerStats(matches) {
    const matchArray = Object.values(matches);
    
    if (matchArray.length === 0) {
        return {
            totalRuns: 0, totalWickets: 0, totalCatches: 0,
            avgEfficiency: 0, strikeRate: 0, economy: 0
        };
    }
    
    const totals = matchArray.reduce((acc, match) => {
        acc.runs += match.runs || 0;
        acc.wickets += match.wickets || 0;
        acc.catches += match.catches || 0;
        acc.ballsFaced += match.balls_faced || 0;
        acc.ballsBowled += match.balls_bowled || 0;
        acc.efficiency += match.efficiency || 0;
        return acc;
    }, { runs: 0, wickets: 0, catches: 0, ballsFaced: 0, ballsBowled: 0, efficiency: 0 });
    
    return {
        totalRuns: totals.runs,
        totalWickets: totals.wickets,
        totalCatches: totals.catches,
        avgEfficiency: totals.efficiency / matchArray.length,
        strikeRate: totals.ballsFaced > 0 ? (totals.runs / totals.ballsFaced) * 100 : 0,
        economy: totals.ballsBowled > 0 ? (totals.runs / (totals.ballsBowled / 6)) : 0
    };
}

function renderPerformanceCharts(playerName, matches, stats) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};
    
    const matchArray = Object.entries(matches).map(([id, match]) => ({
        id, ...match
    }));
    
    // Batting Performance Chart
    const battingCtx = document.getElementById('battingChart').getContext('2d');
    charts.batting = new Chart(battingCtx, {
        type: 'radar',
        data: {
            labels: ['Runs', 'Fours', 'Sixes', 'Strike Rate', 'Dot Balls'],
            datasets: [{
                label: 'Batting Performance',
                data: [
                    stats.totalRuns,
                    matchArray.reduce((sum, m) => sum + (m.fours || 0), 0),
                    matchArray.reduce((sum, m) => sum + (m.sixes || 0), 0),
                    stats.strikeRate,
                    matchArray.reduce((sum, m) => sum + (m.dot_balls || 0), 0)
                ],
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Bowling Performance Chart
    const bowlingCtx = document.getElementById('bowlingChart').getContext('2d');
    charts.bowling = new Chart(bowlingCtx, {
        type: 'doughnut',
        data: {
            labels: ['Wickets', 'Catches', 'Dot Balls'],
            datasets: [{
                data: [
                    stats.totalWickets,
                    stats.totalCatches,
                    matchArray.reduce((sum, m) => sum + (m.dot_balls || 0), 0)
                ],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Efficiency Trend Chart
    const efficiencyCtx = document.getElementById('efficiencyChart').getContext('2d');
    charts.efficiency = new Chart(efficiencyCtx, {
        type: 'line',
        data: {
            labels: matchArray.map(m => m.id),
            datasets: [{
                label: 'Efficiency Score',
                data: matchArray.map(m => m.efficiency || 0),
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Match Performance Chart
    const matchPerfCtx = document.getElementById('matchPerformanceChart').getContext('2d');
    charts.matchPerf = new Chart(matchPerfCtx, {
        type: 'bar',
        data: {
            labels: matchArray.map(m => m.id),
            datasets: [{
                label: 'Runs',
                data: matchArray.map(m => m.runs || 0),
                backgroundColor: 'rgba(102, 126, 234, 0.6)'
            }, {
                label: 'Wickets',
                data: matchArray.map(m => m.wickets || 0),
                backgroundColor: 'rgba(118, 75, 162, 0.6)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderTrendCharts(playerName, matches) {
    // Similar to renderPerformanceCharts but focused on trends over time
    renderPerformanceCharts(playerName, matches, calculatePlayerStats(matches));
}

function renderMatchTable(matches) {
    const matchArray = Object.entries(matches).map(([id, match]) => ({
        id, ...match
    }));
    
    document.getElementById('matches-table-container').innerHTML = `
        <table class="matches-table">
            <thead>
                <tr>
                    <th>Match ID</th>
                    <th>Runs</th>
                    <th>Wickets</th>
                    <th>Catches</th>
                    <th>Balls Faced</th>
                    <th>Fours</th>
                    <th>Sixes</th>
                    <th>Strike Rate</th>
                    <th>Economy</th>
                    <th>Efficiency</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${matchArray.map(match => `
                    <tr>
                        <td>${match.id}</td>
                        <td>${match.runs || 0}</td>
                        <td>${match.wickets || 0}</td>
                        <td>${match.catches || 0}</td>
                        <td>${match.balls_faced || 0}</td>
                        <td>${match.fours || 0}</td>
                        <td>${match.sixes || 0}</td>
                        <td>${(match.strike_rate || 0).toFixed(1)}</td>
                        <td>${(match.economy || 0).toFixed(2)}</td>
                        <td class="efficiency-cell">${(match.efficiency || 0).toFixed(1)}</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="deleteMatch('${document.getElementById('analytics-player-select').value}', '${match.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPerformanceTrends(playerName, matches) {
    const matchArray = Object.entries(matches).map(([id, match]) => ({
        id, ...match
    })).sort((a, b) => a.id.localeCompare(b.id)); // Sort by match ID for chronological order

    if (matchArray.length === 0) {
        document.getElementById('performance-trends').innerHTML = '<p>No matches found for trend analysis.</p>';
        return;
    }

    // Prepare data for trend charts
    const matchIds = matchArray.map(match => match.id);
    
    // Batting trends data
    const strikeRates = matchArray.map(match => match.strike_rate || 0);
    const runsPerMatch = matchArray.map(match => match.runs || 0);
    const boundaries = matchArray.map(match => (match.fours || 0) + (match.sixes || 0));
    const battingEfficiency = matchArray.map(match => {
        // Calculate batting-specific efficiency
        const runs = match.runs || 0;
        const fours = match.fours || 0;
        const sixes = match.sixes || 0;
        const strikeRate = match.strike_rate || 0;
        return (2 * runs + 6 * fours + 8 * sixes + 1.2 * strikeRate);
    });

    // Bowling trends data
    const economyRates = matchArray.map(match => match.economy || 0);
    const wicketsPerMatch = matchArray.map(match => match.wickets || 0);
    const bowlingStrikeRates = matchArray.map(match => {
        const ballsBowled = match.balls_bowled || 0;
        const wickets = match.wickets || 0;
        return wickets > 0 ? ballsBowled / wickets : 0;
    });
    const bowlingEfficiency = matchArray.map(match => {
        // Calculate bowling-specific efficiency
        const wickets = match.wickets || 0;
        const economy = match.economy || 0;
        const catches = match.catches || 0;
        return (30 * wickets + 8 * catches - 4 * economy);
    });

    // Fielding trends data
    const catchesPerMatch = matchArray.map(match => match.catches || 0);
    const fieldingAccuracy = matchArray.map(match => {
        const catches = match.catches || 0;
        const missedCatches = match.missed_catches || 0;
        const totalOpportunities = catches + missedCatches;
        return totalOpportunities > 0 ? (catches / totalOpportunities) * 100 : 100;
    });
    const overallEfficiency = matchArray.map(match => match.efficiency || 0);

    // Create batting trend charts with different chart types
    createTrendLineChart('strikeRateTrendChart', 'Strike Rate Trend', matchIds, strikeRates, 'rgba(54, 162, 235, 1)', 'Strike Rate');
    createTrendBarChart('runsTrendChart', 'Runs per Match', matchIds, runsPerMatch, 'rgba(255, 99, 132, 1)', 'Runs');
    createTrendAreaChart('boundariesTrendChart', 'Boundaries per Match', matchIds, boundaries, 'rgba(255, 206, 86, 1)', 'Boundaries');
    createBattingRadarChart('battingEfficiencyTrendChart', 'Batting Performance Radar', matchArray);

    // Create bowling trend charts with different chart types
    createTrendLineChart('economyTrendChart', 'Economy Rate Trend', matchIds, economyRates, 'rgba(153, 102, 255, 1)', 'Economy Rate');
    createTrendBarChart('wicketsTrendChart', 'Wickets per Match', matchIds, wicketsPerMatch, 'rgba(255, 159, 64, 1)', 'Wickets');
    createBowlingPieChart('bowlingStrikeRateTrendChart', 'Bowling Performance Distribution', matchArray);
    createTrendAreaChart('bowlingEfficiencyTrendChart', 'Bowling Efficiency', matchIds, bowlingEfficiency, 'rgba(83, 102, 255, 1)', 'Efficiency Points');

    // Create fielding trend charts with different chart types
    createTrendBarChart('catchesTrendChart', 'Catches per Match', matchIds, catchesPerMatch, 'rgba(255, 99, 132, 1)', 'Catches');
    createFieldingDoughnutChart('fieldingAccuracyTrendChart', 'Fielding Performance Summary', matchArray);
    createTrendLineChart('overallEfficiencyTrendChart', 'Overall Efficiency', matchIds, overallEfficiency, 'rgba(75, 192, 192, 1)', 'Efficiency Points');
}

function createTrendLineChart(canvasId, title, labels, data, borderColor, yAxisLabel) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: yAxisLabel,
                data: data,
                borderColor: borderColor,
                backgroundColor: borderColor.replace('1)', '0.1)'),
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: borderColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: 'bold' }
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: yAxisLabel },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                x: {
                    title: { display: true, text: 'Match ID' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                }
            }
        }
    });
}

function createTrendBarChart(canvasId, title, labels, data, backgroundColor, yAxisLabel) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: yAxisLabel,
                data: data,
                backgroundColor: backgroundColor.replace('1)', '0.7)'),
                borderColor: backgroundColor,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: yAxisLabel },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                x: {
                    title: { display: true, text: 'Match ID' },
                    grid: { display: false }
                }
            }
        }
    });
}

function createTrendAreaChart(canvasId, title, labels, data, backgroundColor, yAxisLabel) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: yAxisLabel,
                data: data,
                borderColor: backgroundColor,
                backgroundColor: backgroundColor.replace('1)', '0.3)'),
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: backgroundColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: yAxisLabel },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                x: {
                    title: { display: true, text: 'Match ID' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                }
            }
        }
    });
}

function createBattingRadarChart(canvasId, title, matchArray) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    // Calculate average batting stats
    const totalMatches = matchArray.length;
    const avgRuns = matchArray.reduce((sum, match) => sum + (match.runs || 0), 0) / totalMatches;
    const avgStrikeRate = matchArray.reduce((sum, match) => sum + (match.strike_rate || 0), 0) / totalMatches;
    const avgFours = matchArray.reduce((sum, match) => sum + (match.fours || 0), 0) / totalMatches;
    const avgSixes = matchArray.reduce((sum, match) => sum + (match.sixes || 0), 0) / totalMatches;
    const avgBoundaries = avgFours + avgSixes;

    charts[canvasId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Avg Runs', 'Strike Rate', 'Boundaries', 'Consistency', 'Impact'],
            datasets: [{
                label: 'Batting Performance',
                data: [
                    Math.min(avgRuns / 10, 10), // Scale runs to 0-10
                    Math.min(avgStrikeRate / 10, 10), // Scale strike rate to 0-10
                    Math.min(avgBoundaries * 2, 10), // Scale boundaries to 0-10
                    Math.min((1 - (Math.max(...matchArray.map(m => m.runs || 0)) - Math.min(...matchArray.map(m => m.runs || 0))) / 50) * 10, 10), // Consistency
                    Math.min(avgSixes * 3, 10) // Impact (based on sixes)
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16, weight: 'bold' } }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: { stepSize: 2 }
                }
            }
        }
    });
}

function createBowlingPieChart(canvasId, title, matchArray) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    // Calculate bowling performance distribution
    const totalWickets = matchArray.reduce((sum, match) => sum + (match.wickets || 0), 0);
    const totalBallsBowled = matchArray.reduce((sum, match) => sum + (match.balls_bowled || 0), 0);
    const totalRunsConceded = matchArray.reduce((sum, match) => sum + (match.runs_conceded || 0), 0);
    const matchesWithWickets = matchArray.filter(match => (match.wickets || 0) > 0).length;
    const economicalMatches = matchArray.filter(match => (match.economy || 0) < 6).length;

    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Wicket-taking', 'Economical', 'Expensive', 'Wicketless'],
            datasets: [{
                data: [
                    matchesWithWickets,
                    economicalMatches,
                    matchArray.length - economicalMatches,
                    matchArray.length - matchesWithWickets
                ],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
                legend: { position: 'bottom' }
            }
        }
    });
}

function createFieldingDoughnutChart(canvasId, title, matchArray) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    // Calculate fielding stats
    const totalCatches = matchArray.reduce((sum, match) => sum + (match.catches || 0), 0);
    const totalMissedCatches = matchArray.reduce((sum, match) => sum + (match.missed_catches || 0), 0);
    const totalMisfields = matchArray.reduce((sum, match) => sum + (match.misfields || 0), 0);
    const cleanFieldingMatches = matchArray.filter(match => 
        (match.missed_catches || 0) === 0 && (match.misfields || 0) === 0
    ).length;

    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Catches Taken', 'Missed Catches', 'Misfields', 'Clean Fielding'],
            datasets: [{
                data: [totalCatches, totalMissedCatches, totalMisfields, cleanFieldingMatches * 2],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(54, 162, 235, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 16, weight: 'bold' } },
                legend: { position: 'bottom' }
            }
        }
    });
}
