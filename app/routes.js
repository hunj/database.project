// app/routes.js
module.exports = function(app, passport) {

	var mysql = require('mysql');
	var dbconfig = require('../config/database.js');
	var connection = mysql.createConnection(dbconfig.connection, {multipleStatements: true});
	var moment = require('moment');

	connection.query('USE ' + dbconfig.database);

	function getParameterByName(name, url) {
		    if (!url) {
		      url = window.location.href;
		    }
		    name = name.replace(/[\[\]]/g, "\\$&");
		    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		        results = regex.exec(url);
		    if (!results) return null;
		    if (!results[2]) return '';
		    return decodeURIComponent(results[2].replace(/\+/g, " "));
	}

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		res.render('index.ejs'); // load the index.ejs file
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('login.ejs', { message: req.flash('loginMessage') });
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}),
	function(req, res) {
		if (req.body.remember) {
			req.session.cookie.maxAge = 1000 * 60 * 3;
		} else {
			req.session.cookie.expires = false;
		}
		res.redirect('/');
	});

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		// render the page and pass in any flash data if it exists
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// PROFILE SECTION =====================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {
		connection.query("SELECT e.event_id, e.title, e.description, e.start_time, e.end_time, u.username, i.status FROM events e JOIN invites i JOIN users u ON e.event_id = i.event_id and e.event_creator=u.user_id WHERE employee=?"
						, [req.user.user_id], function(err, results) {
			var user_events = [];
			if (err)
				return console.log(err);
			if (results.length) {
				for (var i = 0; i < results.length; i++) {
					var event = {
						id : results[i].event_id,
						title : results[i].title,
						description : results[i].description,
						start_time : results[i].start_time,
						end_time : results[i].end_time,
						username : results[i].username,
						status : results[i].status
					};
					user_events.push(event);
				}
			}

			var is_manager;
			connection.query("SELECT * FROM users u JOIN managers m ON u.user_id=m.user_id AND u.dept=m.dept WHERE u.user_id=?", [req.user.user_id], function(err, result) {
				if (err)
					return console.log(err);
				if (result.length) {
					is_manager = true;
				} else {
					is_manager = false;
				}

				res.render('profile.ejs', {
					user : req.user, // get the user out of session and pass to template
					user_events : user_events,
					is_manager : is_manager
				});
			});


		});
	});

	// accept/decline to event invites within profile page
	app.post('/profile', isLoggedIn, function(req, res) {
		connection.query("UPDATE invites SET status=? WHERE event_id=? AND employee=?", [req.body.status, req.body.event_id, req.user.user_id], function(err, rows) {
			if (err){
				res.redirect(500, '/profile');
				console.log(err);
			}
			else {
				res.redirect('/profile');
			}
		});

	});

	// set employee information
	app.get('/profile/info', isLoggedIn, function(req, res) {

		connection.query("SELECT name, title, dept FROM users WHERE user_id=?", [req.user.user_id], function(err, rows) {
			if (err)
				return console.log(err);
			if (rows.length) {
				var name = '';
				var title = '';
				var dept = '';

				// replace nulls with empty string
				if(rows[0].name != 'null'){
					name = rows[0].name;
				}

				if(rows[0].title != 'null'){
					title = rows[0].title;
				}

				if(rows[0].dept != 'null'){
					dept = rows[0].dept;
				}

				var info = {
					name : name,
					title : title,
					dept : dept
				};

				res.render('profile-info.ejs', {
					user : req.user,
					info : info
				});
			}
		});
	});

	// update employee info
	app.post('/profile/info', isLoggedIn, function(req, res){

		// updates user info
		connection.query("UPDATE users SET name=?, title=?, dept=? WHERE user_id=?",
		[req.body.name, req.body.title, req.body.dept, req.user.user_id], function(err, result){
				if (err)
				return console.log(err);
				else{
					console.log('Updated!');
				}
			});

		res.redirect('/profile');
	});


	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	// =====================================
	// CALENDAR ============================
	// =====================================
	app.get('/calendar', isLoggedIn, function (req, res) {

		// populates a user's calendar with their events
		connection.query("SELECT * FROM events e JOIN invites i ON e.event_id=i.event_id WHERE employee=? AND status=1", [req.user.user_id], function(err, rows) {

			if (err)
			return console.log(err);
			if (rows.length) {
				var results = [];
				for(var i = 0 ; i < rows.length ; i++){
					// create event object
					// insert into results
					// set events below to results
					var event = {
						id : rows[i].event_id,
						title : rows[i].title,
						start : rows[i].start_time,
						end : rows[i].end_time,
						description : rows[i].description,
						created_date : rows[i].created_date
					};
					results.push(event);
				}

				res.render('calendar.ejs', {
					user: req.user,
					results : results
				});
			} else {
				res.render('calendar.ejs', {
					user: req.user,
					results : []
				});
			}
		});
	});

	app.get('/calendar/add', isLoggedIn, function(req, res){
		res.render('calendar-add.ejs');
	});

	app.post('/calendar/add', isLoggedIn, function(req, res){

		// adds an event to a user's calendar
		connection.query("INSERT INTO events (event_creator, event_owner, start_time, end_time, title, description, created_date) \
		VALUES (?, ?, ?, ?, ?, ?, ?)", [req.user.user_id, req.user.user_id, moment(req.body.start_time).format("YYYY-MM-DD HH:mm:ss"), moment(req.body.end_time).format("YYYY-MM-DD HH:mm:ss"), req.body.title, req.body.description, moment().format("YYYY-MM-DD HH:mm:ss")], function(err, result) {
				if (err)
					return console.log(err);
				else {
					// adds to schedules table
					connection.query("INSERT INTO schedules VALUES (LAST_INSERT_ID(),?)", [req.user.user_id], function(err, rows) {
					    if (err)
							return console.log(err);
						else{
							// adds an invite
							connection.query("INSERT INTO invites (event_id, employee, status) \
							VALUES (LAST_INSERT_ID(), ?, ?)", [req.user.user_id, 1], function(err, result){
									if (err)
										return console.log(err);
									console.log('Invited!');
							});
						}
					})

				}
			});

		res.redirect('/calendar');
	});

	// edit an event
	app.post('/calendar/editevent', isLoggedIn, function(req, res){

		// updates user info
		connection.query("UPDATE events SET start_time=?, end_time=?, title=?, description=?, created_date=? WHERE event_id=?", [moment(req.body.start_time).format("YYYY-MM-DD HH:mm:ss"), moment(req.body.end_time).format("YYYY-MM-DD HH:mm:ss"), req.body.title, req.body.description, moment().format("YYYY-MM-DD HH:mm:ss"), req.body.event_id], function(err, result){
				if (err)
				return console.log(err);
				else{
					console.log('Updated!');
				}
			});

		res.redirect('/calendar');
	});

	// delete an event
	app.post('/calendar/deleteevent', isLoggedIn, function(req, res){

		// delete this event
		connection.query("DELETE FROM events WHERE event_id=?",
		[req.body.event_id], function(err, result){
				if (err)
				return console.log(err);
				else{
					console.log('Deleted!');
				}
			});

		res.redirect('/calendar');
	});


	// =====================================
	// INVITE ==============================
	// =====================================
	app.get('/calendar/invite', isLoggedIn, function(req, res) {
		var event_id = getParameterByName('event_id', req.url);
		if (event_id) {
				var usersList = [];

		  	 // get all users to be able to invite any user
		     connection.query("SELECT * FROM users u LEFT JOIN invites i ON u.user_id = i.employee AND i.event_id =? WHERE i.employee IS NULL", [event_id], function(err, rows) {
		     	if (err)
		     		return console.log(err);
		     	if (rows.length) {
		     		for(var i = 0 ; i < rows.length ; i++){
		     			var user_info = {
		     				user_id : rows[i].user_id,
		     				name : rows[i].name,
		     				title : rows[i].title,
		     				dept : rows[i].dept
		     			};
		     			usersList.push(user_info);
		     		}
					}

	     		// get list of current invites to the event
	     		connection.query("SELECT employee, status, name FROM invites i JOIN users u ON u.user_id = i.employee WHERE event_id=?", [event_id], function(err, rows){
	     			if (err)
			     		return console.log(err);
			     	if (rows.length) {
			     		var invitesList = [];

			     		for(var i = 0 ; i < rows.length ; i++){
			     			var invite_info = {
								name: rows[i].name,
			     				employee : rows[i].employee,
			     				status : rows[i].status
			     			};

								invitesList.push(invite_info);
			     		}
			     	}

			     	connection.query("SELECT * FROM events WHERE event_id=?", [event_id], function(err, rows){
			     		if (err)
				     		return console.log(err);
				     	if (rows.length) {
				     		res.render('calendar-invite.ejs', {
				     			user: req.user,
				     			usersList : usersList,
				     			invitesList : invitesList,
				     			event : rows
				     		});
				     	}
			     	});
	     		});
		     });
		}
		else {
			console.log('failed');
	  		res.redirect('/calendar');
		}
	});

	app.post('/calendar/invite/add', isLoggedIn, function(req, res){

		// adds an invite to a given event
		connection.query("INSERT INTO invites (event_id, employee, status) \
		VALUES (?, ?, ?)", [req.body.event_id, req.body.user_id, 0], function(err, result) {
			if (err){
				res.redirect(500, '/calendar/invite?event_id='+req.body.event_id);
				console.log(err);
			}
			else {
				res.redirect('/calendar/invite?event_id='+req.body.event_id);
			}
		});
	});

	app.post('/calendar/invite/delete', isLoggedIn, function(req, res){

		// deletes an invite
		connection.query("DELETE FROM invites WHERE event_id=? AND employee=?",
		[req.body.event_id, req.body.user_id], function(err, result){
				if (err){
					res.redirect(500, '/calendar/invite?event_id='+req.body.event_id);
					console.log(err);
				}
				else{
					res.redirect('/calendar/invite?event_id='+req.body.event_id);
				}
		});
	});


	// =====================================
	// MANAGER =============================
	// =====================================
	app.get('/manager', isLoggedIn, function(req, res){
		var manager_id = getParameterByName('manager_id', req.url);

		// gets lists of subordinates
		connection.query("SELECT u.user_id, u.name FROM users u, manages m WHERE \
						  m.user_id=u.user_id AND \
						  m.manager_id=?", [manager_id], function(err, rows){
			if (err){
				console.log(err);
			}
			else{
				var subsList = [];
	     		for(var i = 0 ; i < rows.length ; i++){
	     			var subs_info = {
	     				user_id : rows[i].user_id,
	     				name : rows[i].name
	     			};
	     			subsList.push(subs_info);
	     		}
	     		console.log(manager_id);
	     		res.render('manager.ejs', {
	     			manager_id : manager_id,
	     			subsList : subsList
	     		});
			}
		});

	});

	app.post('/manager/aggregate', isLoggedIn, function(req, res) {
		var deptHoursQuery = "select sum(hours) as deptHours from (select TIMESTAMPDIFF(hour, e.start_time, e.end_time) as hours from (select s.event_id from schedules s, users u where u.dept=? AND s.employee_id = u.user_id)deptEvents, events e  where e.event_id = deptEvents.event_id) a;"

		// get dept from manager_id
		connection.query("SELECT dept FROM managers where user_id=?", [req.body.manager_id], function(err, rows) {
		    if (err){
		    	console.log(err);
		    }
		    else{
		    	var dept = rows[0].dept;

		    	// gets subordinates who have decline events
		    	var subDeclinesQuery = "select u.name, e.title, e.description from users u, events e, invites i where i.employee=u.user_id AND i.status=2 AND i.event_id=e.event_id AND u.dept=?";

		    	connection.query(subDeclinesQuery, [dept], function(err, rows) {
		    		if(err){
		    	   		console.log(err);
		    		}
		    		else{
			    		var subDeclinesList = [];
			     		for(var i = 0 ; i < rows.length ; i++){
			     			var subDeclines_info = {
			     				name : rows[i].name,
			     				title : rows[i].title,
			     				description : rows[i].description
			     			};
			     			subDeclinesList.push(subDeclines_info);
			     		}

			     		// gets total hours of work scheduled in manager's department
						connection.query(deptHoursQuery, [dept], function(err, rows) {
						    if (err){
								console.log(err);
							}
							else{
								var deptHours = rows[0].deptHours;
								if(deptHours){
									res.render('manager-aggregate.ejs', {
										manager_id : req.body.manager_id,
										dept : dept,
										subDeclinesList : subDeclinesList,
										deptHours : deptHours
									});
								}
								else{
									res.render('manager-aggregate.ejs', {
										manager_id : req.body.manager_id,
										dept : dept,
										subDeclinesList : subDeclinesList,
										deptHours : 0
									});
								}
							}
						});
		    		}
		    	});
		    }
		});
	});

	app.post('/manager/calendar', isLoggedIn, function(req, res) {

	   // populates a calendar with the subordinate's events
		connection.query("SELECT * FROM events e JOIN invites i ON e.event_id=i.event_id WHERE employee=? AND status=1", [req.body.user_id], function(err, rows) {
			if (err)
			return console.log(err);
			if (rows.length) {
				var results = [];
				for(var i = 0 ; i < rows.length ; i++){
					// create event object
					// insert into results
					// set events below to results
					var event = {
						id : rows[i].event_id,
						title : rows[i].title,
						start : rows[i].start_time,
						end : rows[i].end_time,
						description : rows[i].description,
						created_date : rows[i].created_date
					};
					results.push(event);
				}

				res.render('manager-calendar.ejs', {
					name: req.body.name,
					results : results
				});
			} else {
				res.render('manager-calendar.ejs', {
					name: req.body.name,
					results : []
				});
			}
		});

	});
};

// route middleware to make sure
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on
	if (req.isAuthenticated())
	return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
};

// helper method for GET url parameters
// source: https://www.sitepoint.com/get-url-parameters-with-javascript/
function getAllUrlParams(url) {
  // get query string from url (optional) or window
  var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  var obj = {};

  // if query string exists
  if (queryString) {

    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    var arr = queryString.split('&');

    for (var i=0; i<arr.length; i++) {
      // separate the keys and the values
      var a = arr[i].split('=');

      // in case params look like: list[]=thing1&list[]=thing2
      var paramNum = undefined;
      var paramName = a[0].replace(/\[\d*\]/, function(v) {
        paramNum = v.slice(1,-1);
        return '';
      });

      // set parameter value (use 'true' if empty)
      var paramValue = typeof(a[1])==='undefined' ? true : a[1];

      // (optional) keep case consistent
      paramName = paramName.toLowerCase();
      paramValue = paramValue.toLowerCase();

      // if parameter name already exists
      if (obj[paramName]) {
        // convert value to array (if still string)
        if (typeof obj[paramName] === 'string') {
          obj[paramName] = [obj[paramName]];
        }
        // if no array index number specified...
        if (typeof paramNum === 'undefined') {
          // put the value on the end of the array
          obj[paramName].push(paramValue);
        }
        // if array index number specified...
        else {
          // put the value at that index number
          obj[paramName][paramNum] = paramValue;
        }
      }
      // if param name doesn't exist yet, set it
      else {
        obj[paramName] = paramValue;
      }
    }
  }

  return obj;
}
