(function (win) {
    $(document).ready(function () {

        var cricApp = this;
        window.cricApp = cricApp;
        cricApp.databaseName = "Crics";
        cricApp.db = openDatabase(cricApp.databaseName, "1", cricApp.databaseName, 5 * 1024 * 1024);
        cricApp.matches = {};
        cricApp.players = {},
        cricApp.users = [];
        cricApp.loadedMatch = null;
        cricApp.syncURL = "http://www.aslrp.com/cricket/admin/admin/json_sync";
        //cricApp.syncURL = "http://192.168.0.29/cricket/index.php/admin/json_sync";
        
        //batting status object
        cricApp.battingStatus = {
            "1": {"status": "Not Out", "id": "5", "bowlerCredit": 0, "bowlerPoints": 0, "assistPoints": 0},
            "2": {"status": "Did not bat", "id": "4", "bowlerCredit": 0, "bowlerPoints": 0, "assistPoints": 0},
            "3": {"status": "Stump", "id": "3", "bowlerCredit": 1, "bowlerPoints": 5, "assistPoints": 4},
            "4": {"status": "Catch", "id": "2", "bowlerCredit": 1, "bowlerPoints": 4, "assistPoints": 4},
            "5": {"status": "Bowled", "id": "1", "bowlerCredit": 1, "bowlerPoints": 6, "assistPoints": 0},
            "6": {"status": "Hitout", "id": "7", "bowlerCredit": 1, "bowlerPoints": 4, "assistPoints": 0},
            "7": {"status": "Runout", "id": "6", "bowlerCredit": 0, "bowlerPoints": 0, "assistPoints": 4},
            "8": {"status": "Hit wicket", "id": "8", "bowlerCredit": 1, "bowlerPoints": 5, "assistPoints": 0},
            "9": {"status": "Retired hurt", "id": "9", "bowlerCredit": 0, "bowlerPoints": 0, "assistPoints": 0},
            "10": {"status": "LBW", "id": "10", "bowlerCredit": 1, "bowlerPoints": 6, "assistPoints": 0},
        }
        cricApp.initiateDatabase = function () {

            cricApp.db.transaction(function (tx) {
                //tx.executeSql("drop table innings", []);
                //tx.executeSql("drop table matches", []);
                tx.executeSql("CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, name VARCHAR)", []);
                tx.executeSql("CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY AUTOINCREMENT, match_name VARCHAR,overs INTEGER, innings INTEGER, carry_forward_overs INTEGER, team_a VARCHAR, team_b VARCHAR, completed INTEGER, synced INTEGER)", []);
                tx.executeSql("CREATE TABLE IF NOT EXISTS innings(id INTEGER PRIMARY KEY AUTOINCREMENT, innings_number INTEGER, match_id INTEGER, team_id INTEGER,batsman_id INTEGER,bowler_id INTEGER,over_count INTEGER,over_bowl_count INTEGER,runs INTEGER,dismisal_id INTEGER, wicket_to_bowler INTEGER, dismisl_type INTEGER, dismisal_assist_id INTEGER, team_innings_finished INTEGER)", []);
            });
        };
        cricApp.insertUser = function (name, user_id) {
            cricApp.db.transaction(function (tx) {
                tx.executeSql("INSERT INTO players(id, user_id, name) VALUES (?,?,?)", [user_id, user_id, name], function success() {
                }, function error(err) {
                    console.log(err)
                });
            });
        }
        cricApp.deleteMatch = function (id) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql("delete from matches where id= ?", [id], function success() {
                }, function error(err) {
                    console.log(err)
                });
            });
        }
        cricApp.deleteUser = function (id) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql("delete from players where id= ?", [id], function success() {
                }, function error(err) {
                    console.log(err)
                });
            });
        }
        cricApp.insertMatch = function (name, overs, innings, carryForward, teamA, teamB, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql("INSERT INTO matches(match_name, overs, innings, carry_forward_overs, team_a, team_b, completed) VALUES (?,?,?,?,?,?,?)",
                    [name, overs, innings, carryForward, teamA, teamB, 0], function success(tx, results) {
                        if (callback) {
                            callback(results.insertId)
                        }

                    }, function error(err) {
                        callback(0);
                        console.log(err)
                    });
            });
        }
        cricApp.updateMatch = function (id, overs, innings, carryForward, teamA, teamB, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql("update matches set overs=?, innings=?, carry_forward_overs=?, team_a = ?, team_b=? where id = ?",
                    [overs, innings, carryForward, teamA, teamB, id], function success(tx, results) {
                        if (callback) {
                            callback(true)
                        }

                    }, function error(err) {
                        if (callback) {
                            callback(false)
                        }
                        console.log(err)

                    });
            });
        }
        cricApp.closeMatch = function (id, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql("update matches set completed=1 where id = ?",
                    [id], function success(tx, results) {
                        if (callback) {
                            callback(true)
                        }

                    }, function error(err) {
                        if (callback) {
                            callback(false)
                        }
                        console.log(err)

                    });
            });
        }
        cricApp.syncMatch = function (id, callback) {

            var toBeLoaded = null;
            if (!id) {
                alert("id is null");
                return;
            }

            cricApp.getMatch(id, function (matchObject) {

                if (!matchObject) {
                    alert("Match: " + id + " doesnt exists!.");
                    return;
                }

                cricApp.loadInnings(matchObject, function (scoreCard) {

                    if (!scoreCard) {
                        alert("Match: " + id + ", but Scorecard doesnt exists!.");
                        return;
                    }

                    $.ajax({
                        type: "POST",
                        url: cricApp.syncURL,
                        data: {"data": JSON.stringify(cricApp.matches[id])},
                        success: function (data) {
                            if (data === "1") {
                                cricApp.db.transaction(function (tx) {
                                    tx.executeSql("update matches set synced=1 where id = ?",
                                        [id], function success(tx, results) {
                                            if (callback) {
                                                callback(true)
                                            }

                                        }, function error(err) {
                                            if (callback) {
                                                callback(false)
                                            }
                                            console.log(err)

                                        });
                                });
                            }
                            else {
                                callback(false);
                            }

                        },
                        error: function () {
                            callback(false);
                        }
                    });
                });
            });
        }
        cricApp.match = function (teamObj, firstBatting) {
            var cricAppMatch = this;
            cricAppMatch.team = teamObj;
            cricAppMatch.matchTime = Date.now();
            switch (firstBatting) {
                case "A":
                    cricAppMatch.firstBatting = "A"
                    break;
                case"B":
                    cricAppMatch.firstBatting = "A"
                    break;
                default:
                    throw ("Who the f**k is batting first");
            }

        }
        cricApp.team = function (teamUserIndexArrA, teamUserIndexArrB) {
            this.teamA = [];
            this.teamB = [];

            for (var i = 0; i < teamUserIndexArrA.length; i++) {
                this.teamA.push(cricApp.users[teamUserIndexArrA[i]]);
            }
            for (var i = 0; i < teamUserIndexArrB.length; i++) {
                this.teamB.push(cricApp.users[teamUserIndexArrB[i]]);
            }

        }
        cricApp.loadPage = function (page, param) {
            switch (page) {
                case "players":
                    cricApp.loadPlayers(param);
                    break;
                case"matches":
                    cricApp.loadMatches(param);
                    break;
                case"new_match":
                    cricApp.loadNewMatch(param);
                    break;
                case"match_score_card":
                    cricApp.loadScoreCard(param);
                    break;
            }
        }
        cricApp.loadPlayers = function () {
            cricApp.getPlayers(function (rows) {
                cricApp.setPlayers(rows);
                cricApp.UI.renderPlayers(rows);
            });
        }
        cricApp.setPlayers = function (players) {
            var len = players.length, i;
            cricApp.players = {}
            for (i = 0; i < len; i++) {
                cricApp.players[players.item(i).id] = {
                    "id": players.item(i).id,
                    "user_id": players.item(i).user_id,
                    "name": players.item(i).name,
                };
            }
        }
        cricApp.getPlayers = function (callback) {
            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM players order by name', [], function (tx, results) {
                    callback(results.rows)
                });
            });
        }
        cricApp.loadMatches = function () {
            cricApp.getMatches(function (rows) {
                cricApp.UI.renderMatches(rows);
            });
        }
        cricApp.getMatches = function (callback) {
            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM matches order by id desc', [], function (tx, results) {
                    callback(results.rows)
                });
            });
        }
        cricApp.getMatch = function (id, callback) {
            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM matches where id = ?', [id], function (tx, results) {
                    callback((results.rows && results.rows.item && results.rows.item(0)) ? results.rows.item(0) : [])
                });
            });
        }
        cricApp.getInnings = function (matchId, inningsNumber, callback) {
            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM innings where innings_number = ? and match_id = ? ', [inningsNumber, matchId], function (tx, results) {
                    callback(results.rows)
                });
            });
        }
        cricApp.loadNewMatch = function () {

        }

        cricApp.loadInnings = function (match, callback) {
            cricApp.matches[match.id] = [];
            for (var i = 1; i <= match.innings; i++) {
                (function (inningsNumber) {
                    cricApp.getInnings(match.id, inningsNumber, function (rows) {
                        cricApp.matches[match.id].push(new cricApp.scoreCard(match, inningsNumber, rows));
                        if (cricApp.matches[match.id].length === match.innings && callback) {
                            callback(cricApp.matches[match.id]);
                        }
                    });
                })(i);
            }

        }

        cricApp.scoreCard = function (match, inningsNumber, innings) {
            if (!new.target) {
                alert("please treat me as an oject ass.. by Scorecard");
                return;
            }
            var _scoreCard_ = this;

            var BATSMAN = {
                "totalRuns": 0,
                "ballsFaced": 0,
                "0s": 0,
                "1s": 0,
                "2s": 0,
                "3s": 0,
                "4s": 0,
                "6s": 0,
                "BattingStatus": 2,
                "BattingStatusServer": 4,
                "BattingOrder": 0,
                "fallOfWicket": 0,
                "bowlerId": 0,
                "wicketToBowler": 0,
                "dismissalAssistId": 0,
                "dismissedOnOver": "",
                "points": 0,
            };
            var BOWLER = {
                "totalBowls": 0,
                "overs": 0,
                "maidens": 0,
                "runsGiven": 0,
                "wickets": 0,
                "totalOvers": 0,
                "points": 0,
            };

            var ONE_DROP = {
                "id": 0,
                "innings_number": 0,
                "match_id": 0,
                "team_id": 0,
                "batsman_id": 0,
                "bowler_id": 0,
                "over_count": 0,
                "over_bowl_count": 0,
                "runs": 0,
                "dismisal_id": 0,
                "wicket_to_bowler": 0,
                "dismisl_type": 0,
                "dismisal_assist_id": 0,
                "team_innings_finished": 0
            };

            _scoreCard_.match = match;
            _scoreCard_.inningsNumber = inningsNumber;
            _scoreCard_.isInningsOver = false;

            _scoreCard_.teamA = new team(true);
            _scoreCard_.teamB = new team(false);

            _scoreCard_.collectDrops = function () {
                _scoreCard_.teamA.collectDrops();
                _scoreCard_.teamB.collectDrops();
            }

            _scoreCard_.treatOneBall = function (singleDrop) {
                var team;
                team = _scoreCard_.teamA
                if (singleDrop.team_id === 2) {
                    team = _scoreCard_.teamB;
                }
                var oneDrop = _scoreCard_.cloneObject(ONE_DROP);
                for (var key in oneDrop) {
                    if (oneDrop.hasOwnProperty(key)) {
                        oneDrop[key] = singleDrop[key];
                    }
                }
                team.drops[singleDrop.over_bowl_count - 1] = oneDrop;
            }

            treatInnings();
            _scoreCard_.collectDrops();
            function treatInnings() {
                var len = innings.length, i;
                var selected;
                for (i = 0; i < len; i++) {
                    var singleDrop = innings.item(i);
                    _scoreCard_.treatOneBall(singleDrop);
                }
            }

            function team(teamA) {
                if (!new.target) {
                    alert("please treat me as an oject ass.. by Scorecard");
                    return;
                }
                var self = this;

                if (teamA) {
                    var theTeam = match.team_a.split(",");
                }
                else {
                    var theTeam = match.team_b.split(",");
                }

                self.batsmen = {};
                self.bowlers = {};
                self.drops = [];

                self.totalAvailableBalls = 0;
                self.totalPlayedBalls = 0;
                self.isTeamInningsOver = false;
                self.totalRuns = 0;
                self.totalLead = 0;
                self._battingOrder = [];

                self.currentPlayer = null;
                self.previousPlayer = null;

                var i, len = theTeam.length
                for (i = 0; i < len; i++) {
                    self.batsmen[theTeam[i]] = _scoreCard_.cloneObject(BATSMAN);
                    self.bowlers[theTeam[i]] = _scoreCard_.cloneObject(BOWLER);
                }

                self.totalAvailableBalls = cricApp.oversToBalls(match.overs);
                if (match.carry_forward_overs === 1) {
                    if (teamA) {
                        var matchCurrentInnings = cricApp.matches[match.id].length;
                        if (matchCurrentInnings > 0) {
                            self.totalAvailableBalls = cricApp.oversToBalls(match.overs) + (cricApp.matches[match.id][matchCurrentInnings - 1].teamB.totalAvailableBalls - cricApp.matches[match.id][matchCurrentInnings - 1].teamB.totalPlayedBalls)
                        }
                    }
                }

                this.calculatePoints = function (drop, otherTeam) {
                    self.batsmen[drop.batsman_id].points += drop.runs;
                    if (parseInt(drop.dismisal_id) > 0) {
                        if (parseInt(drop.dismisl_type) !== 7 && parseInt(drop.dismisl_type) !== 9) {
                            otherTeam.bowlers[drop.bowler_id].points += cricApp.battingStatus[parseInt(drop.dismisl_type)].bowlerPoints;

                        }
                        if (parseInt(drop.dismisal_assist_id) > 0 && parseInt(drop.dismisl_type) > 0) {
                            otherTeam.bowlers[drop.dismisal_assist_id].points += cricApp.battingStatus[parseInt(drop.dismisl_type)].assistPoints
                        }
                    }
                }

                this.collectDrops = function () {
                    var otherTeam = teamA ? _scoreCard_.teamB : _scoreCard_.teamA;
                    var i, len = self.drops.length;
                    var previousPlayer = null, currentPlayer = null, lastRuns = 0, lastBowler = null;
                    for (i = 0; i < len; i++) {
                        var drop = self.drops[i];
                        if (!drop) {
                            continue;
                        }
                        self.calculatePoints(drop, otherTeam);
                        self.totalPlayedBalls++;
                        self.totalRuns += drop.runs;
                        self.batsmen[drop.batsman_id].totalRuns += drop.runs;
                        self.batsmen[drop.batsman_id].ballsFaced++;

                        switch (parseInt(drop.runs)) {
                            case 0:
                                self.batsmen[drop.batsman_id]['0s']++;
                                break;

                            case 1:
                                self.batsmen[drop.batsman_id]['1s']++;
                                break;

                            case 2:
                                self.batsmen[drop.batsman_id]['2s']++;
                                break;

                            case 3:
                                self.batsmen[drop.batsman_id]['3s']++;
                                break;

                            case 4:
                                self.batsmen[drop.batsman_id]['4s']++;
                                break;

                            case 6:
                                self.batsmen[drop.batsman_id]['6s']++;
                                break;

                        }
                        self.batsmen[drop.batsman_id]['BattingStatus'] = 1;
                        self.batsmen[drop.batsman_id]['BattingStatusServer'] = 5;
                        if (self.batsmen[drop.batsman_id]['BattingOrder'] === 0) {
                            self._battingOrder.push(drop.batsman_id);
                            self.batsmen[drop.batsman_id]['BattingOrder'] = self._battingOrder.length;
                        }

                        if (parseInt(drop.dismisal_id) > 0) {
                            self.batsmen[drop.dismisal_id]['wicketToBowler'] = 0;
                            self.batsmen[drop.dismisal_id]['fallOfWicket'] = parseInt(self.totalRuns);
                            self.batsmen[drop.dismisal_id]['bowlerId'] = parseInt(drop.bowler_id);
                            self.batsmen[drop.dismisal_id]['dismissalAssistId'] = parseInt(drop.dismisal_assist_id);
                            self.batsmen[drop.dismisal_id]['BattingStatus'] = parseInt(drop.dismisl_type);
                            self.batsmen[drop.dismisal_id]['BattingStatusServer'] = cricApp.battingStatus[parseInt(drop.dismisl_type)].id;
                            self.batsmen[drop.dismisal_id]['dismissedOnOver'] = cricApp.ballsToOvers(drop.over_bowl_count);
                            if (parseInt(drop.dismisl_type) !== 7 && parseInt(drop.dismisl_type) !== 9) {
                                self.batsmen[drop.dismisal_id]['wicketToBowler'] = 1;
                            }
                            else {

                                if (self.batsmen[drop.dismisal_id]['BattingOrder'] === 0) {
                                    self._battingOrder.push(drop.dismisal_id);
                                    self.batsmen[drop.dismisal_id]['BattingOrder'] = self._battingOrder.length;
                                }

                            }

                            if (drop.dismisal_id === drop.batsman_id) {
                                currentPlayer = null;
                            }
                            else {
                                previousPlayer = null;
                            }
                        }
                        else {
                            if (currentPlayer !== drop.batsman_id) {
                                previousPlayer = currentPlayer;
                                currentPlayer = drop.batsman_id;
                            }
                        }
                        lastRuns = parseInt(drop.runs);
                        self.lastBowler = parseInt(drop.bowler_id);

                        var intOverCount = parseInt((drop.over_bowl_count - 1) / 6);
                        if (otherTeam.bowlers[drop.bowler_id]) {
                            if (!otherTeam.bowlers[drop.bowler_id]['overs']) {
                                otherTeam.bowlers[drop.bowler_id]['overs'] = {};
                            }
                            if (!otherTeam.bowlers[drop.bowler_id]['overs'][intOverCount]) {
                                otherTeam.bowlers[drop.bowler_id]['overs'][intOverCount] = {
                                    runs: 0,
                                    wickets: 0,
                                    balls: 0
                                };
                            }
                            otherTeam.bowlers[drop.bowler_id]['overs'][intOverCount]["runs"] += drop.runs;
                            otherTeam.bowlers[drop.bowler_id]['overs'][intOverCount]["balls"] += 1;
                            if (parseInt(drop.dismisal_id) > 0 && self.batsmen[drop.dismisal_id]['wicketToBowler'] === 1) {
                                otherTeam.bowlers[drop.bowler_id]['overs'][intOverCount]["wickets"] += 1;
                            }
                        }

                        if (drop.team_innings_finished === 1) {
                            self.isTeamInningsOver = true;

                            if (match.carry_forward_overs === 1) {
                                if (teamA) {

                                    var balanceBalls = self.totalAvailableBalls - self.totalPlayedBalls;
                                    otherTeam.totalAvailableBalls += balanceBalls;


                                }
                                else {
                                    if (inningsNumber === 1) {
                                        if (self.totalRuns > otherTeam.totalRuns) {
                                            self.totalLead = self.totalRuns - otherTeam.totalRuns;
                                            otherTeam.totalLead = 0;
                                        }
                                        else {
                                            otherTeam.totalLead = otherTeam.totalRuns - self.totalRuns;
                                            self.totalLead = 0
                                        }
                                    }
                                }

                            }

                            if (self.isTeamInningsOver === true && otherTeam.isTeamInningsOver === true) {
                                _scoreCard_.isInningsOver = true;
                            }

                        }
                    }//loop ends
                    var boolLastRun = false;
                    if (lastRuns === 3 || lastRuns === 1) {
                        boolLastRun = true;
                    }
                    if ((boolLastRun === true && (self.totalPlayedBalls % 6 !== 0)) || (boolLastRun !== true && (self.totalPlayedBalls % 6 === 0))) {
                        var tempStr = previousPlayer;
                        previousPlayer = currentPlayer;
                        currentPlayer = tempStr;
                    }
                    self.currentPlayer = currentPlayer;
                    self.previousPlayer = previousPlayer;

                    for (var bowlerIdKey in otherTeam.bowlers) {
                        if (otherTeam.bowlers.hasOwnProperty(bowlerIdKey)) {
                            if (otherTeam.bowlers[bowlerIdKey]["overs"]) {
                                for (var overKey in otherTeam.bowlers[bowlerIdKey]["overs"]) {
                                    if (otherTeam.bowlers[bowlerIdKey]["overs"].hasOwnProperty(overKey)) {
                                        if (otherTeam.bowlers[bowlerIdKey]["overs"][overKey].balls === 6 && otherTeam.bowlers[bowlerIdKey]["overs"][overKey].runs === 0) {
                                            otherTeam.bowlers[bowlerIdKey]["maidens"] += 1;
                                        }
                                        otherTeam.bowlers[bowlerIdKey]["runsGiven"] += otherTeam.bowlers[bowlerIdKey]["overs"][overKey].runs;
                                        otherTeam.bowlers[bowlerIdKey]["totalBowls"] += otherTeam.bowlers[bowlerIdKey]["overs"][overKey].balls;
                                        otherTeam.bowlers[bowlerIdKey]["totalOvers"] = cricApp.ballsToOvers(otherTeam.bowlers[bowlerIdKey]["totalBowls"]);
                                        otherTeam.bowlers[bowlerIdKey]["wickets"] += otherTeam.bowlers[bowlerIdKey]["overs"][overKey].wickets;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        cricApp.ballsToOvers = function (balls) {
            var over = parseInt(balls / 6) + ((balls % 6) / 10);
            if (over % 1 === 0) {
                over = over + ".0";
            }
            return over;
        }

        cricApp.oversToBalls = function (overs) {
            return (parseInt(overs) * 6) + Math.round((overs - parseInt(overs)) * 10);
        }


        cricApp.scoreCard.prototype.cloneObject = function (obj) {
            return JSON.parse(JSON.stringify(obj))
        }

        cricApp.loadScoreCard = function (match, inningsNum, lastUpdatedBall) {
            inningsNum = inningsNum ? inningsNum : 1;
            cricApp.getMatch(match, function (matchObject) {
                cricApp.loadInnings(matchObject, function (scoreCard) {
                    cricApp.loadedMatch = matchObject;
                    cricApp.UI.renderScoreCard(matchObject, scoreCard, inningsNum, lastUpdatedBall);
                });

            })
        }
        cricApp.formattedDate = function () {
            var d = new Date(),
                minutes = d.getMinutes().toString().length == 1 ? '0' + d.getMinutes() : d.getMinutes(),
                hours = d.getHours().toString().length == 1 ? '0' + d.getHours() : d.getHours(),
                ampm = d.getHours() >= 12 ? 'pm' : 'am',
                months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear() + ' ' + hours + ':' + minutes + ampm;
        }
        cricApp.init = function () {
            cricApp.initiateDatabase();
            cricApp.UI.init();
            cricApp.loadPlayers();
        }
        cricApp.FinishTeamsPlay = function (singleDrop, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM innings where innings_number = ? and match_id = ? and team_id = ?  order by id desc limit 1',
                    [singleDrop.innings, singleDrop.matchId, singleDrop.teamId], function (tx, results) {
                        if (results.rows && results.rows.length > 0) {
                            cricApp.db.transaction(function (tx) {
                                tx.executeSql("update innings set team_innings_finished = 1 where id = ?  ",
                                    [results.rows.item(0).id], function success(tx, resultUpdate) {
                                        if (callback) {
                                            callback(1);
                                        }

                                    }, function error(transcation, err) {
                                        if (callback) {
                                            callback(0);
                                        }
                                        console.log(err)

                                    });
                            });
                        }

                    });
            });

        }
        cricApp.insertDrop = function (singleDrop, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM innings where innings_number = ? and match_id = ? and team_id = ? and over_bowl_count = ?',
                    [singleDrop.innings, singleDrop.matchId, singleDrop.teamId, singleDrop.overBalls], function (tx, results) {
                        if (results.rows && results.rows.length > 0) {
                            cricApp.db.transaction(function (tx) {
                                tx.executeSql("update innings set batsman_id = ?, bowler_id = ?, over_count = ?, over_bowl_count = ?, runs = ?, dismisal_id = ?, wicket_to_bowler = ?, dismisl_type = ?, dismisal_assist_id = ?, team_innings_finished = ? where innings_number = ? and match_id = ? and team_id = ? and over_bowl_count = ?",
                                    [singleDrop.batsman, singleDrop.bowler, singleDrop.over, singleDrop.overBalls, singleDrop.runs, singleDrop.dismissedBatsman, singleDrop.wicketToBowler, singleDrop.dismissedReason, singleDrop.dismissedAssist, 0, singleDrop.innings, singleDrop.matchId, singleDrop.teamId, singleDrop.overBalls], function success(tx, results) {
                                        if (callback) {
                                            callback(1)
                                        }

                                    }, function error(transcation, err) {
                                        if (callback) {
                                            callback(0);
                                        }
                                        console.log(err)

                                    });
                            });
                        }
                        else {
                            cricApp.db.transaction(function (tx) {
                                tx.executeSql("insert into innings (innings_number, match_id, team_id, batsman_id, bowler_id, over_count, over_bowl_count, runs, dismisal_id, wicket_to_bowler, dismisl_type, dismisal_assist_id, team_innings_finished) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                                    [singleDrop.innings, singleDrop.matchId, singleDrop.teamId, singleDrop.batsman, singleDrop.bowler, singleDrop.over, singleDrop.overBalls, singleDrop.runs, singleDrop.dismissedBatsman, singleDrop.wicketToBowler, singleDrop.dismissedReason, singleDrop.dismissedAssist, 0], function success(tx, results) {
                                        if (callback) {
                                            callback(results.insertId)
                                        }

                                    }, function error(transcation, err) {
                                        if (callback) {
                                            callback(0);
                                        }
                                        console.log(err)

                                    });
                            });
                        }
                    });
            });


        }
        cricApp.selectOneDrop = function (innings, match_id, team_id, overBalls, callback) {

            cricApp.db.transaction(function (tx) {
                tx.executeSql('SELECT * FROM innings where innings_number = ? and match_id = ? and team_id = ? and over_bowl_count = ?',
                    [innings, match_id, team_id, overBalls], function (tx, results) {
                        if (results.rows && results.rows.length > 0) {
                            callback(results.rows.item(0))
                        }
                        else {
                            callback(null);
                        }
                    });
            });


        }
        cricApp.getPendingBatsmen = function (batsmen) {
            var countVal = 0;
            for (var key in batsmen) {
                if (batsmen.hasOwnProperty(key)) {
                    if (batsmen[key].BattingStatus === 1 || batsmen[key].BattingStatus === 2) {
                        countVal++;
                    }
                }
            }
            return countVal;
        };
        cricApp.getWicketsCount = function (batsmen) {
            var countVal = 0;
            for (var key in batsmen) {
                if (batsmen.hasOwnProperty(key)) {
                    if (!(batsmen[key].BattingStatus === 1 || batsmen[key].BattingStatus === 2)) {
                        countVal++;
                    }
                }
            }
            return countVal;
        };
        cricApp.IsNotOut = function (key, batsmen) {
            if (batsmen[key] && (batsmen[key].BattingStatus === 1 || batsmen[key].BattingStatus === 2)) {
                return true;
            }
            return false;
        };
        cricApp.playSounds = function (drop) {
            if (parseInt(drop.dismissedBatsman) > 0 && parseInt(drop.runs) === 0) {
                innings = cricApp.matches[drop.matchId][parseInt(drop.innings) - 1];
                team = parseInt(drop.teamId) === 1 ? innings.teamA : innings.teamB;
                if (parseInt(team.batsmen[drop.dismissedBatsman].totalRuns) === 0) {
                    cricApp.playForDuck();
                }
            }
            else if (parseInt(drop.runs) === 4) {
                cricApp.playForFour();
            }
            else if (parseInt(drop.runs) === 6) {
                cricApp.playForSix();
            }
        };
        cricApp.showDramas = function (drop) {
            if (parseInt(drop.dismissedBatsman) > 0 && parseInt(drop.runs) === 0) {
                innings = cricApp.matches[drop.matchId][parseInt(drop.innings) - 1];
                team = parseInt(drop.teamId) === 1 ? innings.teamA : innings.teamB;
                if (parseInt(team.batsmen[drop.dismissedBatsman].totalRuns) === 0) {
                    if (parseInt(team.batsmen[drop.dismissedBatsman].ballsFaced) <= 1) {
                        cricApp.UI.showDramalayer("golden_duck");
                    }
                    else {
                        cricApp.UI.showDramalayer("duck");
                    }
                }
            }
            else if (parseInt(drop.runs) === 4) {
                //cricApp.UI.showDramalayer("four");
            }
            else if (parseInt(drop.runs) === 6) {
                cricApp.UI.showDramalayer("six");
            }
        };
        cricApp.playForDuck = function () {
            var ping = new Audio("media/duck.mp3");
            ping.play()
        };
        cricApp.playForFour = function () {
            var ping = new Audio("media/clap_small.mp3");
            ping.play()
        };
        cricApp.playForSix = function () {
            var ping = new Audio("media/clap_small.mp3");
            ping.play()
        };
        cricApp.getMomString = function (momObjectArr) {
            var outputStrArr = [];
            if (!momObjectArr || momObjectArr.length <= 0) {
                return '';
            }

            for (var i = 0; i < momObjectArr.length; i++) {
                momObject = momObjectArr[i];
                outputStrArr.push(cricApp.players[momObject.player].name + " (" + momObject.points + ")");
            }
            return outputStrArr.join();
        }
        cricApp.getManOfTheMatch = function (matchId) {
            var innings = cricApp.matches[matchId];
            var players = {};
            var bestPlayers = [];
            for (var i = 0; i < innings.length; i++) {
                var currentInnings = innings[i];

                for (var key in currentInnings.teamA.batsmen) {
                    if (currentInnings.teamA.batsmen.hasOwnProperty(key)) {
                        if (!players[key]) {
                            players[key] = 0;
                        }
                        players[key] += currentInnings.teamA.batsmen[key].points;
                    }
                }
                for (var key in currentInnings.teamA.bowlers) {
                    if (currentInnings.teamA.bowlers.hasOwnProperty(key)) {
                        if (!players[key]) {
                            players[key] = 0;
                        }
                        players[key] += currentInnings.teamA.bowlers[key].points;
                    }
                }

                for (var key in currentInnings.teamB.batsmen) {
                    if (currentInnings.teamB.batsmen.hasOwnProperty(key)) {
                        if (!players[key]) {
                            players[key] = 0;
                        }
                        players[key] += currentInnings.teamB.batsmen[key].points;
                    }
                }
                for (var key in currentInnings.teamB.bowlers) {
                    if (currentInnings.teamB.bowlers.hasOwnProperty(key)) {
                        if (!players[key]) {
                            players[key] = 0;
                        }
                        players[key] += currentInnings.teamB.bowlers[key].points;
                    }
                }
            }
            var tempMaxPoints = 0;
            for (var key in players) {
                if (players.hasOwnProperty(key)) {
                    if (players[key] >= tempMaxPoints) {

                        if (players[key] === tempMaxPoints) {
                            bestPlayers.push({player: key, points: players[key]});
                        }
                        else {
                            bestPlayers = [{player: key, points: players[key]}];
                        }
                        tempMaxPoints = players[key];
                    }
                }
            }
            return bestPlayers;

        };
        cricApp.UI = {

            _html_scorecard_batsman: '<tr> <td>_cricApp_batsman_</td> <td>_cricApp_bating_status_ <span>_cricApp_assist_</span></td> <td><span>_cricApp_bowler_</span></td> <td><strong><span>_cricApp_batsman_runs_</span></strong>(<span>_cricApp_batsman_balls_</span>) <td><span>_cricApp_batsman_edit_</span></td></tr>	  <tr><td colspan="3"><span>6s:_cricApp_batsman_6s_, 4s:_cricApp_batsman_4s_, 3s:_cricApp_batsman_3s_, 2s:_cricApp_batsman_2s_, 1s:_cricApp_batsman_1s_, 0s:_cricApp_batsman_0s_</span></td><td colspan="2">SR : <span>_cricApp_batsman_strike_rate</span></td></tr>',
            _html_scorecard_bowler: '<div class="cls_card_bowler_data">_cricApp_bowler_data_</div>',

            init: function () {
                $(".pageItem").hide();
                this.loadListners();
                this.showPage("matches", false);

            },
            loadListners: function () {
                $('body').on('click', '.cls_delete_player', function (e) {

                    if (confirm('Are you sure to delete this?')) {
                        var playerPK = ($(this).attr('item'));
                        cricApp.deleteUser(playerPK);
                        cricApp.UI.showPage("players", false)
                    }
                    return false;
                });

                $('body').on('click', '.cls_delete_match', function (e) {

                    if (confirm('Are you sure to delete this?')) {
                        var matchPK = ($(this).attr('item'));
                        cricApp.deleteMatch(matchPK);
                        cricApp.UI.showPage("matches", false)
                    }
                    return false;
                });

                $('body').on('click', '.cls_close_match', function (e) {

                    if (confirm('Are you sure to close the match?')) {
                        var matchPK = ($(this).attr('item'));
                        cricApp.closeMatch(matchPK);
                        cricApp.UI.showPage("matches", false)
                    }
                    return false;
                });

                $('body').on('click', '#id_btn_new_match', function (e) {
                    cricApp.UI.showPage("new_match", false);
                    cricApp.UI.renderNewMatch();
                    return false;
                    ;
                });
                $('body').on('click', '.cls_scorecard_match', function (e) {
                    var match = ($(this).attr('item'));
                    cricApp.UI.showPage("match_score_card", false, match);
                    return false;
                    ;
                });
                $('body').on('click', '.cls_edit_match', function (e) {
                    var match = ($(this).attr('item'));
                    cricApp.getMatch(match, function (match) {
                        cricApp.UI.renderExistingMatch(match);
                        cricApp.UI.showPage("new_match", false);
                    });
                    return false;
                    ;
                });
                $('body').on('click', '.cls_copy_match', function (e) {
                    var match = ($(this).attr('item'));
                    cricApp.getMatch(match, function (match) {
                        cricApp.UI.renderCopyMatch(match);
                        cricApp.UI.showPage("new_match", false);
                    });
                    return false;
                    ;
                });
                $('body').on('click', '#id_btn_swap_team', function (e) {
                    cricApp.UI.swapTeamMembers();
                    return false;
                    ;
                });
                $('body').on('click', '.leftMenuItem', function (e) {
                    var page = ($(this).attr('item'));
                    cricApp.UI.showPage(page);
                    return false;
                    ;
                });
                $('body').on('click', '#id_btn_new_player', function (e) {
                    var name = $("#id_user_name").val();
                    var user_id = $("#id_user_id").val();
                    if (name.length > 1 && parseInt(user_id) > 0) {
                        // enable vibration support
                        navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;

                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }
                        name = name.toUpperCase()
                        cricApp.insertUser(name, user_id);
                        $("#id_user_name").val('');
                        $("#id_user_id").val('');
                        cricApp.UI.showPage("players", false)
                    }
                    else {
                        alert("Not a valid input");
                    }
                    return false;
                });
                $('body').on('click', '#id_btn_new_match_submit', function (e) {
                    var matchName = $("#id_match_new_name").html();
                    var numInnings = $("#id_match_new_num_innings").val();
                    var numOvers = $("#id_match_new_num_overs").val();
                    var carryOvers = $("#id_match_new_carry_overs_bool").is(":checked");
                    var teamA = $("#id_match_new_team_a").val();
                    var teamB = $("#id_match_new_team_b").val();
                    var updateId = $("#id_hid_match_id").val();
                    carryOvers = carryOvers ? 1 : 0;
                    if (matchName.length > 1 && parseInt(numInnings) > 0 && parseInt(numOvers) > 0 && teamA && teamB && teamA.length > 1 && teamB.length > 1) {
                        if (updateId === "") {
                            cricApp.insertMatch(matchName, numOvers, numInnings, carryOvers, teamA, teamB, function (insertedId) {
                                cricApp.UI.showPage("matches", false);
                            });
                        }
                        else {
                            cricApp.updateMatch(updateId, numOvers, numInnings, carryOvers, teamA, teamB, function (isUpdated) {
                                cricApp.UI.showPage("matches", false);
                            });
                        }
                    }
                    else {
                        alert("Not a valid input");
                    }
                    return false;
                    ;
                });
                $('body').on('click', '.cls_scorecard_innings li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_innings_btn", $(this).text(), "Innings" + " - " + $(this).text());
                    cricApp.loadScoreCard(cricApp.loadedMatch.id, parseInt($(this).text()));
                    cricApp.UI.checkSavebuttonsEligibility();
                });
                $('body').on('click', '.cls_scorecard_overs li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", $(this).text(), "Overs" + " - " + $(this).text());
                    cricApp.UI.checkSavebuttonsEligibility();
                    cricApp.UI.editOneDrop();
                });
                $('body').on('click', '.cls_scorecard_bowlers li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", $(this).attr('player_id'), "Bowler" + " - " + $(this).text());
                    cricApp.UI.checkSavebuttonsEligibility();
                });
                $('body').on('click', '.cls_scorecard_batsman li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", $(this).attr('player_id'), "Batsman" + " - " + $(this).text());
                    cricApp.UI.checkSavebuttonsEligibility();
                });
                $('body').on('click', '.cls_runs_btn', function (e) {
                    $(".cls_runs_btn").removeClass('cls_selected');
                    $(this).addClass('cls_selected');
                    cricApp.UI.checkSavebuttonsEligibility();

                });

                $('body').on('click', '.cls_scorecard_batsman_dismissed li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_dismissed_btn", $(this).attr('player_id'), "Out" + " - " + $(this).text());
                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", "", "Assi" + " - " + "");
                    cricApp.UI.checkSavebuttonsEligibility();
                });

                $('body').on('click', '.cls_scorecard_dismissal_assist li a', function (e) {
                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", $(this).attr('player_id'), "Assi" + " - " + $(this).text());
                    cricApp.UI.checkSavebuttonsEligibility();
                });

                $('body').on('click', '.cls_scorecard_reason_dismissed li a', function (e) {

                    var drop = cricApp.UI.getOneDropFromUI();

                    if (parseInt(drop.batsman) > 0 && parseInt($(this).attr('dism_type_id')) > 0) {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_dismissed_btn", drop.batsman, "Out" + " - " + cricApp.players[drop.batsman].name);
                    }

                    cricApp.UI.changeDropDownValue(".cls_scorecard_reason_dismissed_btn", $(this).attr('dism_type_id'), "How" + " - " + $(this).text());
                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", "", "Assi" + " - " + "");
                    cricApp.UI.checkSavebuttonsEligibility();
                });

                $('body').on('click', '.cls_btn_save_valid', function (e) {
                    var drop = cricApp.UI.getOneDropFromUI();
                    cricApp.UI.makeSaveButtonInvalid();
                    cricApp.insertDrop(drop, function () {
                        cricApp.playSounds(drop);
                        cricApp.showDramas(drop);
                        cricApp.loadScoreCard(drop.matchId, drop.innings, parseInt(drop.overBalls))
                    });

                });
                $('body').on('click', '#id_btn_end_game', function (e) {
                    alert("This will end the team's bating");
                    if (confirm("Are you sure ? ")) {
                        var drop = cricApp.UI.getOneDropFromUI();
                        var mom = cricApp.getManOfTheMatch(drop.matchId);
                        if (parseInt(drop.innings) > 1 && parseInt(drop.teamId) > 1) {
                            cricApp.UI.showDramalayer("mom", cricApp.getMomString(mom), function () {
                                cricApp.FinishTeamsPlay(drop, function () {
                                    cricApp.loadScoreCard(drop.matchId, drop.innings);
                                });
                            });
                        }
                        else {
                            cricApp.FinishTeamsPlay(drop, function () {
                                cricApp.loadScoreCard(drop.matchId, drop.innings);
                            });
                        }


                    }
                });
                $('body').on('click', '#id_btn_clear_match_all', function (e) {
                    alert("This will clear all matches and innings data");
                    if (confirm("Are you sure ? ")) {
                        cricApp.db.transaction(function (tx) {
                            tx.executeSql("delete from innings", []);
                            tx.executeSql("delete from matches", []);

                        });
                        cricApp.UI.showPage("matches", false);
                    }
                });
                $('body').on('click', '#id_btn_first_ball', function (e) {

                    cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", "0.1", "Overs" + " - " + "0.1");
                    cricApp.UI.checkSavebuttonsEligibility();
                    cricApp.UI.editOneDrop();

                });
                $('body').on('click', '#id_btn_previous_ball', function (e) {

                    var drop = cricApp.UI.getOneDropFromUI();
                    var prevBall = parseInt(drop.overBalls) - 1;
                    if (prevBall > 0) {
                        var overStr = cricApp.ballsToOvers(prevBall);
                        cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", overStr, "Overs" + " - " + overStr);
                        cricApp.UI.checkSavebuttonsEligibility();
                        cricApp.UI.editOneDrop();
                    }

                });
                $('body').on('click', '#id_btn_next_ball', function (e) {

                    var drop = cricApp.UI.getOneDropFromUI();
                    var nextBall = parseInt(drop.overBalls) + 1;
                    if (nextBall > 0) {
                        scoreCard = cricApp.matches[drop.matchId][parseInt(drop.innings) - 1];
                        if (scoreCard) {
                            if (scoreCard.teamA.isTeamInningsOver) {
                                var battingTeam = scoreCard.teamB;
                            }
                            else {
                                var battingTeam = scoreCard.teamA;
                            }
                            if (parseInt(battingTeam.totalPlayedBalls) >= parseInt(nextBall)) {

                                var overStr = cricApp.ballsToOvers(nextBall);
                                cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", overStr, "Overs" + " - " + overStr);
                                cricApp.UI.checkSavebuttonsEligibility();
                                cricApp.UI.editOneDrop();
                            }
                        }
                    }

                });
                $('body').on('click', '#id_btn_last_ball', function (e) {

                    var drop = cricApp.UI.getOneDropFromUI();
                    cricApp.loadScoreCard(drop.matchId, drop.innings);

                });
                $('body').on('click', '.cls_sync_before_sync.cls_close_match_synced.cls_close_match_syncing', function (e) {

                    if (confirm('Are you sure to sync the match?')) {
                        $(this).removeClass(".cls_close_match_synced");
                        var matchPK = parseInt(($(this).attr('item')));
                        cricApp.syncMatch(matchPK, function (success) {
                            if (success) {
                                alert("Match Synced !");
                            }
                            cricApp.UI.showPage("matches", false);
                        });

                    }
                    return false;

                });
                $('body').on('click', '.cls_show_dismissal', function (e) {
                    var over = ($(this).attr('item'));
                    cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", over, "Overs" + " - " + over);
                    cricApp.UI.checkSavebuttonsEligibility();
                    cricApp.UI.editOneDrop();
                    return false;
                    ;
                });

            },
            changeDropDownValue: function (selector, value, dispText) {
                $(selector + " span").first().text(dispText);
                $(selector).val(value);
            },
            showPage: function (page, slideBoolean, param) {
                $(".pageItem").hide();
                $(".leftMenuItem").removeClass("active");
                $("#menu_" + page).addClass("active");
                $("#" + page).show();
                if (slideBoolean !== false) {
                    $("#id_slide_button").click();
                }
                cricApp.loadPage(page, param);
            },
            renderPlayers: function (players) {
                $("#id_player_container").html('');
                var len = players.length, i;
                for (i = 0; i < len; i++) {
                    var trRow = '<tr><td>' + (i + 1) + '</td><td>' + players.item(i).user_id + '</td><td>' + players.item(i).name + '</td><td><button type="button"  item="' + players.item(i).id + '" class="btn btn-danger btn-xs cls_delete_player">Delete</button></td></tr>'
                    $("#id_player_container").append(trRow);
                }
            },
            renderMatches: function (matches) {
                $("#id_match_list_container").html('');
                var len = matches.length, i;
                var completed = ''
                var synced = ''
                for (i = 0; i < len; i++) {
                    if (matches.item(i).completed === 1) {
                        completed = "&nbsp;&nbsp;" + '<span style="color:green" class="glyphicon glyphicon-ok"></span>';
                        if (matches.item(i).synced === 1) {
                            synced = "&nbsp;&nbsp;" + '<span style="color:green" class="glyphicon glyphicon glyphicon-thumbs-up"></span>'
                        }
                        else {
                            synced = "&nbsp;&nbsp;" + '<button type="button"  item="' + matches.item(i).id + '" class="btn btn-success btn-xs cls_sync_match cls_sync_before_sync cls_close_match_synced cls_close_match_syncing">Sync</button>';
                        }
                        synced = "&nbsp;&nbsp;" + '<button type="button"  item="' + matches.item(i).id + '" class="btn btn-success btn-xs cls_sync_match cls_sync_before_sync cls_close_match_synced cls_close_match_syncing">Sync</button>';
                    }
                    else {
                        completed = "&nbsp;&nbsp;" + '<button type="button"  item="' + matches.item(i).id + '" class="btn btn-success btn-xs cls_close_match">Close</button>';
                    }

                    var trRow = '<tr><td>' + (i + 1) + '</td><td>' + matches.item(i).match_name +
                        '</td><td><button type="button"  item="' + matches.item(i).id +
                        '" class="btn btn-warning btn-xs cls_edit_match">Edit</button> &nbsp;<button type="button"  item="' + matches.item(i).id +
                        '" class="btn btn-warning btn-xs cls_copy_match">Copy Match</button> &nbsp;<button type="button"  item="' +
                        matches.item(i).id + '" class="btn btn-danger btn-xs cls_delete_match">Delete</button>  &nbsp;<button type="button"  item="' +
                        matches.item(i).id + '" class="btn btn-primary btn-xs cls_scorecard_match">Score Card</button> ' + completed + synced + '</td></tr>'
                    $("#id_match_list_container").append(trRow);
                }
            },
            renderNewMatch: function () {
                $("#new_match .page-header h1").html("New Match");
                $("#id_btn_new_match_submit").html("Start The Game");
                $("#id_match_new_name").text(cricApp.formattedDate());
                $('#id_match_new_team_a, #id_match_new_team_b').html('');
                $("#id_match_new_num_innings").val(2);
                $("#id_match_new_num_overs").val(15);
                $("#id_hid_match_id").val('');
                cricApp.getPlayers(function (players) {
                    var len = players.length, i;
                    for (i = 0; i < len; i++) {
                        $('#id_match_new_team_a, #id_match_new_team_b').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name
                        }));
                    }
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect({
                        buttonWidth: '100%',
                        numberDisplayed: 8
                    });
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect('rebuild');
                });
            },
            renderExistingMatch: function (match) {
                $("#new_match .page-header h1").html("Modify Match");
                $("#id_btn_new_match_submit").html("Update");
                $("#id_match_new_name").text(match.match_name);
                $("#id_match_new_num_innings").val(match.innings);
                $("#id_match_new_num_overs").val(match.overs);
                if (match.carry_forward_overs === 1) {
                    $("#id_match_new_carry_overs_bool").prop('checked', true);
                }
                else {
                    $("#id_match_new_carry_overs_bool").prop('checked', false);
                }
                $('#id_match_new_team_a, #id_match_new_team_b').html('');
                var teamAplayers = match.team_a.split(",");
                var teamBplayers = match.team_b.split(",");
                cricApp.getPlayers(function (players) {
                    var len = players.length, i;
                    var selected;
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamAplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_a').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamBplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_b').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect({
                        buttonWidth: '100%',
                        numberDisplayed: 8
                    });
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect('rebuild');
                    $("#id_hid_match_id").val(match.id);
                });
            },
            renderCopyMatch: function (match) {
                $("#new_match .page-header h1").html("New Match");
                $("#id_btn_new_match_submit").html("Start The Game");
                $("#id_match_new_name").text(cricApp.formattedDate());
                $("#id_match_new_num_innings").val(match.innings);
                $("#id_match_new_num_overs").val(match.overs);
                if (match.carry_forward_overs === 1) {
                    $("#id_match_new_carry_overs_bool").prop('checked', true);
                }
                else {
                    $("#id_match_new_carry_overs_bool").prop('checked', false);
                }
                $('#id_match_new_team_a, #id_match_new_team_b').html('');
                var teamAplayers = match.team_a.split(",");
                var teamBplayers = match.team_b.split(",");
                cricApp.getPlayers(function (players) {
                    var len = players.length, i;
                    var selected;
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamAplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_a').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamBplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_b').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect({
                        buttonWidth: '100%',
                        numberDisplayed: 8
                    });
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect('rebuild');
                    $("#id_hid_match_id").val('');
                });
            },
            swapTeamMembers: function () {

                var teamA = $("#id_match_new_team_a").val();
                var teamB = $("#id_match_new_team_b").val();

                $('#id_match_new_team_a, #id_match_new_team_b').html('');
                var teamAplayers = teamB;
                var teamBplayers = teamA;
                cricApp.getPlayers(function (players) {
                    var len = players.length, i;
                    var selected;
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamAplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_a').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    for (i = 0; i < len; i++) {
                        selected = false;
                        if (teamBplayers.indexOf(players.item(i).id.toString()) > -1) {
                            var selected = true
                        }
                        $('#id_match_new_team_b').append($('<option>', {
                            value: players.item(i).id,
                            text: players.item(i).name,
                            selected: selected
                        }));

                    }
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect({
                        buttonWidth: '100%',
                        numberDisplayed: 8
                    });
                    $('#id_match_new_team_a, #id_match_new_team_b').multiselect('rebuild');

                });

            },
            hideScorecardInputs: function () {
                $(".scoreDrpGroup").hide();
                $(".cls_scorecard_innings_btn").parent().show();
            },
            showScorecardInputs: function () {
                $(".scoreDrpGroup").show();
            },
            setScorecardOvers: function (availalbeBalls, playedBalls) {
                var appendStr = '';
                var over = 0;
                var nextBall = playedBalls + 1;
                for (var i = 1; i <= availalbeBalls; i++) {
                    over = cricApp.ballsToOvers(i);
                    appendStr += '<li id="id_overVal_' + i + '"><a href="#">' + over + '</a></li>';
                }
                $(".cls_scorecard_overs").html(appendStr);

                if (nextBall >= availalbeBalls) {
                    nextBall = availalbeBalls;
                }
                nextBallOvers = cricApp.ballsToOvers(nextBall);

                cricApp.UI.changeDropDownValue(".cls_scorecard_overs_btn", nextBallOvers, "Overs" + " - " + nextBallOvers);
                cricApp.UI.hideOversListUI(nextBall + 1);

            },
            setScorecardBowlers: function (bowlers) {
                var appendStr = '';
                for (var key in bowlers) {
                    if (bowlers.hasOwnProperty(key)) {
                        appendStr += '<li><a player_id="' + key + '" href="#">' + cricApp.players[key].name + '</a></li>';
                    }
                }
                $(".cls_scorecard_bowlers").html(appendStr);

            },
            setScorecardDismAssists: function (bowlers) {
                var appendStr = '';
                for (var key in bowlers) {
                    if (bowlers.hasOwnProperty(key)) {
                        appendStr += '<li><a player_id="' + key + '" href="#">' + cricApp.players[key].name + '</a></li>';
                    }
                }
                $(".cls_scorecard_dismissal_assist").html(appendStr);

            },
            setScorecardBatsmen: function (batsmen) {
                var appendStr = '';
                for (var key in batsmen) {
                    if (batsmen.hasOwnProperty(key)) {
                        if (batsmen[key].BattingStatus === 1 || batsmen[key].BattingStatus === 2) {
                            appendStr += '<li><a player_id="' + key + '" href="#">' + cricApp.players[key].name + '</a></li>';
                        }
                    }
                }
                $(".cls_scorecard_batsman").html(appendStr);

            },
            setScorecardDismBatsmen: function (batsmen) {
                var appendStr = '<li><a player_id="" href="#">---</a></li>';
                for (var key in batsmen) {
                    if (batsmen.hasOwnProperty(key)) {
                        if (batsmen[key].BattingStatus === 1 || batsmen[key].BattingStatus === 2) {
                            appendStr += '<li><a player_id="' + key + '" href="#">' + cricApp.players[key].name + '</a></li>';
                        }
                    }
                }
                $(".cls_scorecard_batsman_dismissed").html(appendStr);

            },
            setScorecardDismTypes: function () {
                var appendStr = '';
                for (var key in cricApp.battingStatus) {
                    if (cricApp.battingStatus.hasOwnProperty(key)) {
                        if (key === "1" || key === "2") {
                            continue;
                        }
                        appendStr += '<li><a dism_type_id="' + key + '" href="#">' + cricApp.battingStatus[key].status + '</a></li>';
                    }
                }
                $(".cls_scorecard_reason_dismissed").html(appendStr);
            },
            renderScoreCard: function (match, scoreCard, inningsNum, lastUpdatedBall) {
                //console.log(scoreCard);
                lastUpdatedBall = lastUpdatedBall ? parseInt(lastUpdatedBall) : -1;
                inningsNum = parseInt(inningsNum);
                var teamId = 1;
                if (scoreCard[inningsNum - 2]) {
                    if (scoreCard[inningsNum - 2].isInningsOver === false) {
                        alert("Please finish previous innings");
                        cricApp.UI.renderScoreCard(match, scoreCard, inningsNum - 1, lastBall);
                        return;
                    }
                }

                var inningsScoreCard = scoreCard[inningsNum - 1];
                var battingTeam = inningsScoreCard.teamA;
                var bowlingTeam = inningsScoreCard.teamB;
                if (inningsScoreCard.teamA.isTeamInningsOver) {
                    teamId = 2;
                    battingTeam = inningsScoreCard.teamB;
                    bowlingTeam = inningsScoreCard.teamA;
                }
                cricApp.UI.calculateScoresAndLabels(scoreCard, inningsScoreCard, inningsNum, teamId);
                if (parseInt(lastUpdatedBall) >= 0 && parseInt(lastUpdatedBall) !== parseInt(battingTeam.totalPlayedBalls)) {
                    cricApp.UI.renderThisOver(battingTeam.drops);
                    return;
                }


                $("#id_scorecard_match_name").text(match.match_name);
                cricApp.UI.changeDropDownValue(".cls_scorecard_innings_btn", inningsNum, "Innings" + " - " + inningsNum);
                cricApp.UI.hideScorecardInputs();
                cricApp.UI.makeSaveButtonInvalid();


                if (!inningsScoreCard.isInningsOver && !match.completed) {
                    cricApp.UI.setScorecardOvers(battingTeam.totalAvailableBalls, battingTeam.totalPlayedBalls);
                    cricApp.UI.setScorecardBowlers(bowlingTeam.bowlers);
                    cricApp.UI.setScorecardBatsmen(battingTeam.batsmen);
                    cricApp.UI.setScorecardDismBatsmen(battingTeam.batsmen);
                    cricApp.UI.setScorecardDismTypes();
                    cricApp.UI.setScorecardDismAssists(bowlingTeam.bowlers);
                    cricApp.UI.showScorecardInputs();

                    $("#id_hid_match_id").val(match.id);
                    $("#id_hid_team_id").val(teamId);

                    if (battingTeam.currentPlayer && cricApp.IsNotOut(battingTeam.currentPlayer, battingTeam.batsmen)) {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", cricApp.players[battingTeam.currentPlayer].id, "Batsman" + " - " + cricApp.players[battingTeam.currentPlayer].name);
                    }
                    else {
                        if (cricApp.getPendingBatsmen(battingTeam.batsmen) === 1 && cricApp.IsNotOut(battingTeam.previousPlayer, battingTeam.batsmen)) {
                            cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", cricApp.players[battingTeam.previousPlayer].id, "Batsman" + " - " + cricApp.players[battingTeam.previousPlayer].name);
                        }
                        else {
                            cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", "", "Batsman" + " - " + "");
                        }
                    }


                    if (battingTeam.lastBowler && (parseInt(battingTeam.totalPlayedBalls) % 6 === 0)) {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", "", "Bowler" + " - " + "");
                    }
                    else if (battingTeam.lastBowler) {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", cricApp.players[battingTeam.lastBowler].id, "Bowler" + " - " + cricApp.players[battingTeam.lastBowler].name);
                    }
                    else {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", "", "Bowler" + " - " + "");
                    }

                    $(".cls_runs_btn.cls_selected").removeClass("cls_selected");
                    $("#id_scored_runs_0").addClass("cls_selected");


                    $("#id_score_card_current_team").text(teamId === 1 ? "Team A" : "Team B");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_dismissed_btn", "", "Out" + " - " + "");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", "", "Assi" + " - " + "");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_reason_dismissed_btn", "", "How" + " - " + "");

                    cricApp.UI.checkSavebuttonsEligibility(match, scoreCard, inningsNum, battingTeam, bowlingTeam);
                    cricApp.UI.renderThisOver(battingTeam.drops);
                }

                cricApp.UI.checkTeamBattingOver(scoreCard, inningsScoreCard, inningsNum, teamId);
            },
            listPlayers: function (team, elemId) {
                var i, len = team._battingOrder.length, tempStr = '';
                $("#" + elemId).html('');
                for (i = 0; i < len; i++) {
                    var batsmanId = team._battingOrder[i];
                    var batsmanObj = team.batsmen[batsmanId];
                    tempStr = cricApp.UI._html_scorecard_batsman.replace('_cricApp_batsman_', cricApp.players[batsmanId].name);
                    if (batsmanObj.BattingStatus === 1) {
                        tempStr = tempStr.replace('_cricApp_bating_status_', "<span style='color:green'>" + cricApp.battingStatus[batsmanObj.BattingStatus].status + "</span>");
                        tempStr = tempStr.replace('_cricApp_batsman_runs_', batsmanObj.totalRuns + "*");
                        tempStr = tempStr.replace('_cricApp_batsman_edit_', "");
                    }
                    else {
                        //console.log(team);
                        tempStr = tempStr.replace('_cricApp_bating_status_', cricApp.battingStatus[batsmanObj.BattingStatus].status);
                        tempStr = tempStr.replace('_cricApp_batsman_runs_', batsmanObj.totalRuns);
                        if (team.isTeamInningsOver) {
                            tempStr = tempStr.replace('_cricApp_batsman_edit_', "");
                        }
                        else {
                            tempStr = tempStr.replace('_cricApp_batsman_edit_', '<button type="button" item="' + batsmanObj.dismissedOnOver + '" class="btn btn-primary btn-xs cls_show_dismissal">view</button>');
                        }
                    }

                    tempStr = tempStr.replace('_cricApp_batsman_balls_', batsmanObj.ballsFaced);
                    tempStr = tempStr.replace('_cricApp_batsman_6s_', batsmanObj['6s']);
                    tempStr = tempStr.replace('_cricApp_batsman_4s_', batsmanObj['4s']);
                    tempStr = tempStr.replace('_cricApp_batsman_3s_', batsmanObj['3s']);
                    tempStr = tempStr.replace('_cricApp_batsman_2s_', batsmanObj['2s']);
                    tempStr = tempStr.replace('_cricApp_batsman_1s_', batsmanObj['1s']);
                    tempStr = tempStr.replace('_cricApp_batsman_0s_', batsmanObj['0s']);
                    tempStr = tempStr.replace('_cricApp_batsman_strike_rate', Math.round((batsmanObj.totalRuns / batsmanObj.ballsFaced) * 100) + "%");

                    if (batsmanObj.dismissalAssistId > 0) {
                        tempStr = tempStr.replace('_cricApp_assist_', cricApp.players[batsmanObj.dismissalAssistId].name);
                    }
                    else {
                        tempStr = tempStr.replace('_cricApp_assist_', '');
                    }
                    if (batsmanObj.bowlerId > 0) {
                        tempStr = tempStr.replace('_cricApp_bowler_', 'B. ' + cricApp.players[batsmanObj.bowlerId].name);
                    }
                    else {
                        tempStr = tempStr.replace('_cricApp_bowler_', '');
                    }

                    $("#" + elemId).append(tempStr);
                }

            },
            listBowlers: function (team, elemId) {
                var i, len = team._battingOrder.length, tempStr = '';

                $("#" + elemId).html('');

                for (var bowlerId in team.bowlers) {
                    tempStr = "";
                    if (team.bowlers.hasOwnProperty(bowlerId) && team.bowlers[bowlerId]["overs"] && typeof team.bowlers[bowlerId].overs === "object") {
                        var overData = cricApp.ballsToOvers(team.bowlers[bowlerId].totalBowls);
                        var maidenData = team.bowlers[bowlerId].maidens;
                        var runs = team.bowlers[bowlerId].runsGiven;
                        var wickets = team.bowlers[bowlerId].wickets;
                        var bowlerData = cricApp.players[bowlerId].name + " : " + overData + " - " + maidenData + " - " + runs + " - " + wickets;
                        tempStr = cricApp.UI._html_scorecard_bowler.replace('_cricApp_bowler_data_', bowlerData);
                        $("#" + elemId).append(tempStr);
                    }
                }
            },
            makeSaveButtonInvalid: function () {
                $("#id_btn_save_a_drop").removeClass("cls_btn_save_valid");
                $("#id_btn_save_a_drop").addClass("cls_btn_save_invalid");
            },
            makeSaveButtonValid: function () {
                $("#id_btn_save_a_drop").removeClass("cls_btn_save_invalid");
                $("#id_btn_save_a_drop").addClass("cls_btn_save_valid");
            },
            checkSavebuttonsEligibility: function () {

                var dropObj = this.getOneDropFromUI();
                cricApp.UI.changeElementValidityColor(dropObj);
                if (!parseInt(dropObj.innings) > 0 || !parseInt(dropObj.bowler) > 0 || !parseInt(dropObj.batsman) > 0 ||
                    !cricApp.oversToBalls(dropObj.over) > 0 || !(parseInt(dropObj.runs) >= 0)) {
                    this.makeSaveButtonInvalid();
                    return false;
                }

                if (parseInt(dropObj.dismissedBatsman) > 0) {
                    if (!parseInt(dropObj.dismissedReason) > 0) {
                        this.makeSaveButtonInvalid();
                        return false;
                    }

                    switch (parseInt(dropObj.dismissedReason)) {
                        case 3:
                        case 4:
                        case 7:
                            if (!parseInt(dropObj.dismissedAssist) > 0) {
                                this.makeSaveButtonInvalid();
                                return false;
                            }
                            break;
                    }
                }

                if (parseInt(dropObj.dismissedReason) > 0 && parseInt(dropObj.dismissedReason) !== 7 && (parseInt(dropObj.runs) > 0)) {
                    this.makeSaveButtonInvalid();
                    return false;
                }

                if (parseInt(dropObj.dismissedReason) > 0 && parseInt(dropObj.dismissedReason) === 7 && (parseInt(dropObj.runs) > 3)) {
                    this.makeSaveButtonInvalid();
                    return false;
                }


                this.makeSaveButtonValid();


            },
            changeElementValidityColor: function (dropObj) {

                $(".cls_scorecard_innings_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_overs_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_bowlers_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_batsman_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_batsman_dismissed_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_dismissal_assist_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");
                $(".cls_scorecard_reason_dismissed_btn").addClass("cls_btn_invalid").removeClass("cls_btn_valid");

                if (parseInt(dropObj.innings) > 0) {
                    $(".cls_scorecard_innings_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.overBalls) > 0) {
                    $(".cls_scorecard_overs_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.bowler) > 0) {
                    $(".cls_scorecard_bowlers_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.batsman) > 0) {
                    $(".cls_scorecard_batsman_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.dismissedBatsman) > 0) {
                    $(".cls_scorecard_batsman_dismissed_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.dismissedAssist) > 0) {
                    $(".cls_scorecard_dismissal_assist_btn").addClass("cls_btn_valid");
                }
                if (parseInt(dropObj.dismissedReason) > 0) {
                    $(".cls_scorecard_reason_dismissed_btn").addClass("cls_btn_valid");
                }


            },
            getOneDropFromUI: function () {
                var dropObj = {};
                dropObj.innings = $(".cls_scorecard_innings_btn").val();
                dropObj.over = $(".cls_scorecard_overs_btn").val();
                dropObj.overBalls = cricApp.oversToBalls(dropObj.over);
                dropObj.bowler = $(".cls_scorecard_bowlers_btn").val();
                dropObj.batsman = $(".cls_scorecard_batsman_btn").val();
                dropObj.runs = $(".cls_runs_btn.cls_selected").val();
                dropObj.dismissedBatsman = $(".cls_scorecard_batsman_dismissed_btn").val();
                dropObj.dismissedReason = $(".cls_scorecard_reason_dismissed_btn").val();
                dropObj.dismissedAssist = $(".cls_scorecard_dismissal_assist_btn").val();
                dropObj.matchId = $("#id_hid_match_id").val();
                dropObj.teamId = $("#id_hid_team_id").val();
                dropObj.wicketToBowler = 0;
                if (parseInt(dropObj.dismissedBatsman) > 0) {
                    if (parseInt(dropObj.dismissedReason) !== 7) {
                        dropObj.wicket_to_bowler = 1;
                    }
                }
                return dropObj;
            },
            editOneDrop: function () {
                var currentDrop = cricApp.UI.getOneDropFromUI();
                cricApp.selectOneDrop(currentDrop.innings, currentDrop.matchId, currentDrop.teamId, currentDrop.overBalls, function (selectedDrop) {

                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", "", "Assi" + " - " + "");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_reason_dismissed_btn", "", "How" + " - " + "");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_dismissed_btn", "", "Out" + " - " + "");

                    cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", "", "Bowler" + " - " + "");
                    cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", "", "Batsman" + " - " + "");

                    if (selectedDrop) {
                        cricApp.UI.changeDropDownValue(".cls_scorecard_bowlers_btn", cricApp.players[selectedDrop.bowler_id].id, "Bowler" + " - " + cricApp.players[selectedDrop.bowler_id].name);
                        cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_btn", cricApp.players[selectedDrop.batsman_id].id, "Batsman" + " - " + cricApp.players[selectedDrop.batsman_id].name);
                        $(".cls_runs_btn").removeClass('cls_selected');
                        $('#id_scored_runs_' + selectedDrop.runs).addClass('cls_selected');
                        if (parseInt(selectedDrop.dismisal_id) > 0) {
                            cricApp.UI.changeDropDownValue(".cls_scorecard_batsman_dismissed_btn", cricApp.players[selectedDrop.dismisal_id].id, "Out" + " - " + cricApp.players[selectedDrop.dismisal_id].name);

                            if (parseInt(selectedDrop.dismisl_type) > 0) {
                                cricApp.UI.changeDropDownValue(".cls_scorecard_reason_dismissed_btn", selectedDrop.dismisl_type, "How" + " - " + cricApp.battingStatus[selectedDrop.dismisl_type].status);

                                if (parseInt(selectedDrop.dismisal_assist_id) > 0) {
                                    cricApp.UI.changeDropDownValue(".cls_scorecard_dismissal_assist_btn", cricApp.players[selectedDrop.dismisal_assist_id].id, "Assi" + " - " + cricApp.players[selectedDrop.dismisal_assist_id].name);
                                }
                            }

                        }

                        scoreCard = cricApp.matches[currentDrop.matchId][parseInt(currentDrop.innings) - 1];
                        if (scoreCard) {
                            if (scoreCard.teamA.isTeamInningsOver) {
                                cricApp.UI.renderThisOver(scoreCard.teamB.drops);
                            }
                            else {
                                cricApp.UI.renderThisOver(scoreCard.teamB.drops);
                            }
                        }
                        //console.log(currentDrop);
                    }
                });
            },
            renderThisOver: function (drops) {
                $("#id_this_over_1").text('');
                $("#id_this_over_2").text('');
                $("#id_this_over_3").text('');
                $("#id_this_over_4").text('');
                $("#id_this_over_5").text('');
                $("#id_this_over_6").text('');
                var dropObj = this.getOneDropFromUI();
                currentBall = dropObj.overBalls - 1;
                var start = parseInt(currentBall) - (parseInt(currentBall) % 6);
                var counter = 0;
                for (var i = start; i < drops.length; i++) {
                    var wicketStr = '';

                    if (drops[i]) {
                        wicketStr = drops[i].runs;
                        if (parseInt(drops[i].dismisal_id) > 0) {
                            wicketStr = drops[i].runs + "" + "w";
                        }
                    }
                    else {
                        wicketStr = "?"
                    }
                    counter++;
                    if (counter > 6) {
                        break;
                    }
                    $("#id_this_over_" + counter).text(wicketStr);

                }
            },
            hideOversListUI: function (fromNum) {
                while (1) {
                    var elem = $("#id_overVal_" + fromNum);
                    if (elem.length === 0) {
                        break;
                    }
                    elem.hide();
                    fromNum++;
                }
            },

            checkTeamBattingOver: function (scoreCard, inningsScoreCard, inningsNum, teamId) {
                console.log(inningsScoreCard);

                var matchStatus = null;
                if (inningsNum === 1 && inningsScoreCard.match.innings === 1) {

                    if (!inningsScoreCard.teamB.isTeamInningsOver && inningsScoreCard.teamA.isTeamInningsOver) {

                        if (inningsScoreCard.teamB.totalRuns > inningsScoreCard.teamA.totalRuns) {
                            matchStatus = "Team B Won the match !!,";
                        }

                        else if (inningsScoreCard.teamB.totalAvailableBalls - inningsScoreCard.teamB.totalPlayedBalls === 0) {
                            matchStatus = "End of the overs, Team A Won the match, ";
                            if (inningsScoreCard.teamB.totalRuns === inningsScoreCard.teamA.totalRuns) {
                                matchStatus = "End of the overs, Match drawn!!, ";
                            }
                        }
                        else if (cricApp.getPendingBatsmen(inningsScoreCard.teamB.batsmen) === 0) {
                            matchStatus = "Team A Won the match !!,";
                        }
                    }
                    else if (!inningsScoreCard.teamA.isTeamInningsOver) {
                        if (inningsScoreCard.teamA.totalAvailableBalls - inningsScoreCard.teamA.totalPlayedBalls === 0) {
                            matchStatus = "End of the overs,";
                        }
                        else if (cricApp.getPendingBatsmen(inningsScoreCard.teamA.batsmen) === 0) {
                            matchStatus = "All out!!,";
                        }
                    }
                }

                if (matchStatus) {

                    if (confirm(matchStatus + " End batting session now?")) {
                        $("#id_btn_end_game").click();
                    }

                }

            },
            calculateScoresAndLabels: function (scoreCard, inningsScoreCard, inningsNum, teamId) {
                var teamAmatchStatus = '';
                var teamBmatchStatus = '';

                cricApp.UI.listPlayers(inningsScoreCard.teamA, "id_score_match_list_container_A");
                cricApp.UI.listBowlers(inningsScoreCard.teamB, "id_score_match_bowlers_list_container_A");
                cricApp.UI.listPlayers(inningsScoreCard.teamB, "id_score_match_list_container_B");
                cricApp.UI.listBowlers(inningsScoreCard.teamA, "id_score_match_bowlers_list_container_B");

                $("#id_tema_a_total_runs").text(inningsScoreCard.teamA.totalRuns + "/" + cricApp.getWicketsCount(inningsScoreCard.teamA.batsmen));
                $("#id_tema_a_total_overs").text(cricApp.ballsToOvers(inningsScoreCard.teamA.totalPlayedBalls));
                $("#id_tema_a_balance_overs").text(cricApp.ballsToOvers(inningsScoreCard.teamA.totalAvailableBalls - inningsScoreCard.teamA.totalPlayedBalls));

                $("#id_tema_b_total_runs").text(inningsScoreCard.teamB.totalRuns + "/" + cricApp.getWicketsCount(inningsScoreCard.teamB.batsmen));
                $("#id_tema_b_total_overs").text(cricApp.ballsToOvers(inningsScoreCard.teamB.totalPlayedBalls));
                $("#id_tema_b_balance_overs").text(cricApp.ballsToOvers(inningsScoreCard.teamB.totalAvailableBalls - inningsScoreCard.teamB.totalPlayedBalls));

                if (inningsNum === 1) {
                    if (inningsScoreCard.teamA.isTeamInningsOver) {
                        if (inningsScoreCard.match.innings !== 1) {

                            if (inningsScoreCard.teamA.totalRuns > inningsScoreCard.teamB.totalRuns) {
                                teamBmatchStatus = "Trail By " + (inningsScoreCard.teamA.totalRuns - inningsScoreCard.teamB.totalRuns);
                            }
                            else {
                                teamBmatchStatus = "Lead By " + (inningsScoreCard.teamB.totalRuns - inningsScoreCard.teamA.totalRuns);
                            }
                        }
                        else {
                            teamBmatchStatus = (inningsScoreCard.teamA.totalRuns - inningsScoreCard.teamB.totalRuns) + 1 + " more run(s) to win";
                        }
                    }
                    if (inningsScoreCard.teamB.isTeamInningsOver) {
                        if (inningsScoreCard.match.innings === 1) {

                            if (inningsScoreCard.teamA.totalRuns > inningsScoreCard.teamB.totalRuns) {
                                teamBmatchStatus = "Lost the match by " + (inningsScoreCard.teamA.totalRuns - inningsScoreCard.teamB.totalRuns) + "runs !";
                                teamAmatchStatus = "Won the match !!";
                            }
                            else if (inningsScoreCard.teamA.totalRuns < inningsScoreCard.teamB.totalRuns) {
                                teamBmatchStatus = "Won the match !!";
                                teamAmatchStatus = "Lost the match !";
                            }
                            else {
                                teamBmatchStatus = "Match drawn !";
                                teamAmatchStatus = "Match drawn !";
                            }

                        }
                    }
                }
                else {
                    var teamATotal = inningsScoreCard.teamA.totalRuns + scoreCard[inningsNum - 2].teamA.totalLead;
                    var teamBTotal = inningsScoreCard.teamB.totalRuns + scoreCard[inningsNum - 2].teamB.totalLead;

                    if (teamId === 1) {
                        if (teamATotal > teamBTotal) {
                            teamAmatchStatus = "Lead By" + (teamATotal - teamBTotal);
                        }
                        else {
                            teamAmatchStatus = "Trail By " + (teamBTotal - teamATotal);
                        }
                    }
                    else {
                        if (teamBTotal > teamATotal) {
                            teamBmatchStatus = "Won !!";
                        }
                        else {
                            teamBmatchStatus = (teamATotal - teamBTotal + 1) + " more runs to win. ";
                        }
                        teamAmatchStatus = "Grand Total : " + (teamATotal);
                    }
                }
                $("#id_tema_a_game_status").text(teamAmatchStatus);
                $("#id_tema_b_game_status").text(teamBmatchStatus);
            },
            showDramalayer: function (caseStr, str, callback) {
                var img = null;
                var string = str ? str : '';
                switch (caseStr) {
                    case "duck":
                        img = "images/duck.gif"
                        break;
                    case"golden_duck":
                        img = "images/golden_duck.gif"
                        break;
                    case"four":
                        img = "images/boundry.gif"
                        break;
                    case"six":
                        img = "images/boundry.gif"
                        break;
                    case"mom":
                        img = "images/mom.jpg"
                        break;
                }
                if (img) {
                    $("#id_img_drama_layer").attr("src", img);
                    $("#id_str_drama_layer").text(string);
                    $(".cls_layer_drama").show(500, function () {
                        setTimeout(function () {
                            $(".cls_layer_drama").hide(500);
                            if (callback) {
                                callback();
                            }
                        }, 4000);

                    });
                }

            }
        }
        cricApp.init();
    })
})();
