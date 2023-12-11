const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const bcrypt = require('bcrypt');
const swaggerDocument = require('./swagger.json'); //  API documentation
const crypto = require('crypto');
require('./enhancer'); // Import the enhancement logic

const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Create a table for storing health check data
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS health_checks (id INTEGER PRIMARY KEY, symptoms TEXT, conditions TEXT)');
});

// Create a table for storing user data
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
});

// Create a table for storing feedback data
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY, message TEXT)');
});

// Create a table for storing health condition data (if needed)
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS conditions (id INTEGER PRIMARY KEY, name TEXT, description TEXT)');
});

// Use the session middleware
const secret = crypto.randomBytes(64).toString('hex');

app.use(session({
  secret: secret,
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Set up a local strategy for authentication
passport.use(new LocalStrategy(
  (username, password, done) => {
    // authentication logic
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        return done(err);
      }

      if (!row) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      bcrypt.compare(password, row.password, (err, isMatch) => {
        if (err) {
          return done(err);
        }

        if (isMatch) {
          return done(null, row);
        } else {
          return done(null, false, { message: 'Incorrect password.' });
        }
      });
    });
  }
));

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser((id, done) => {
  // Replace this with your actual user retrieval logic
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      return done(err);
    }

    if (!row) {
      return done(null, false);
    }

    return done(null, { id: row.id, username: row.username });
  });
});

// Registration endpoint
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Check if username or password is missing
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check if the username is already taken
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (row) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash the password before storing it
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      // Insert the new user into the database
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.json({ message: 'Registration successful' });
      });
    });
  });
});


// Serve the login page
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Serve the login script
app.get('/login.js', (req, res) => {
  res.sendFile(__dirname + '/public/login.js');
});

// Handle login form submission
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard', // Redirect to the dashboard on successful login
  failureRedirect: '/login', // Redirect back to the login page on failed login
}));

// Secure a route with authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login'); // Redirect to login page if not authenticated
  }
}

// Secure a route with authentication
app.get('/secureRoute', ensureAuthenticated, (req, res) => {
  res.send(`Welcome, ${req.user.username}! This is a secure route. <a href="/logout">Logout</a>`);
});

// Welcome route
app.get('/', (req, res) => {
  res.send('Welcome to HealthCheck!');
});

app.get('/checkHealth', (req, res) => {
  res.send('This is the /checkHealth endpoint');
});

// HealthCheck endpoint
app.post('/checkHealth', (req, res) => {
  const symptoms = req.body.symptoms || [];

  // Check if symptoms is an array and is not empty
  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const suggestedConditions = getEnhancedSuggestions(symptoms);
  const conditions = suggestedConditions.join(', ');

  try {
    // Store health check data in the database
    db.run('INSERT INTO health_checks (symptoms, conditions) VALUES (?, ?)', [symptoms.join(', '), conditions]);

    res.json({
      suggestedConditions: conditions,
      inputSymptoms: symptoms,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while storing the health check data' });
  }
});


// Serve the Swagger UI for API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Import the API routes
const apiRoutes = require('./api');

// Use the API routes
app.use('/api', apiRoutes);

// Set up static files directory (for HTML, CSS, and client-side JavaScript)
app.use(express.static('public'));

// Get all health checks from the database
app.get('/healthChecks', (req, res) => {
  db.all('SELECT * FROM health_checks', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(rows);
    }
  });
});

// Serve the Dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// Logout route

app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

// Add a new endpoint to retrieve user information
app.get('/api/user', (req, res) => {
  // Replace this with your actual user retrieval logic
  if (req.isAuthenticated()) {
    const userId = req.user.id;

    // Fetch user information from the database based on the user's ID
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Replace the following line with your actual user object structure
      const user = { id: row.id, username: row.username, email: row.email };
      res.json(user);
    });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});


// Add a new endpoint to change the user's password
app.post('/api/changePassword', (req, res) => {
  const { newPassword } = req.body;

  // Replace this with your actual password change logic
  // Example: Get the currently authenticated user
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Example: Hash the new password
  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Example: Update the password in the database
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';

    db.run(updateQuery, [hashedPassword, currentUser.id], (updateErr) => {
      if (updateErr) {
        console.error('Error updating password:', updateErr);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      res.json({ message: 'Password changed successfully' });
    });
  });
});
;

/** 
 * Enhances the given symptoms and returns an array of enhanced suggestions.
 * @param {string[]} symptoms - The array of symptoms to be enhanced.
 * @returns {string[]} - The array of enhanced suggestions.
 */
function getEnhancedSuggestions(symptoms) {
  // enhancement logic here based on the actual symptoms
  const enhancedSuggestions = symptoms.map(symptom => {
      let enhancedSymptom = symptom;

      // Example enhancement logic: Append adjectives based on symptoms
      if (symptom.includes('headache')) {
          enhancedSymptom = `Intense ${symptom}`;
      } else if (symptom.includes('nausea')) {
          enhancedSymptom = `Persistent ${symptom}`;
      } else {
          enhancedSymptom = `Mild ${symptom}`;
      }

      return enhancedSymptom;
  });

  return enhancedSuggestions;
}


module.exports = { getEnhancedSuggestions };


// new endpoint to retrieve details about specific health conditions
app.get('/conditions/:conditionId', (req, res) => {
  const conditionId = req.params.conditionId;

  // logic to fetch details about the specified health condition from your database or an external API
  const conditionDetails = getConditionDetails(conditionId);

  if (conditionDetails) {
    res.json({ conditionId, conditionDetails });
  } else {
    res.status(404).json({ error: 'Condition not found' });
  }
});

// new endpoint to retrieve recent health checks
app.get('/api/recentHealthChecks', (req, res) => {
  
  const selectQuery = 'SELECT * FROM health_checks ORDER BY id DESC LIMIT 5';

  // a database query to retrieve recent health checks
  db.all(selectQuery, (error, rows) => {
    if (error) {
      console.error('Error retrieving recent health checks:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(rows);
    }
  });
});

// new endpoint to submit a health check
app.post('/api/submitHealthCheck', (req, res) => {
  const { symptoms } = req.body;

  // table named 'health_checks'
  const insertQuery = 'INSERT INTO health_checks (symptoms) VALUES (?)';

  // database query to store the health check
  db.run(insertQuery, [symptoms.join(', ')], (error) => {
    if (error) {
      console.error('Error storing health check:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ message: 'Health check submitted successfully' });
    }
  });
});


// new endpoint to submit feedback
app.post('/api/submitFeedback', (req, res) => {
  const { feedback } = req.body;

  // table name: feedback
  
  const query = 'INSERT INTO feedback (message) VALUES (?)';

  // database query to store the feedback
  db.run(query, [feedback], (err) => {
    if (err) {
      console.error('Error storing feedback:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ message: 'Feedback submitted successfully' });
    }
  });
});

// new endpoint to retrieve details about specific health conditions
app.get('/conditions/:conditionId', (req, res) => {
  const conditionId = req.params.conditionId;

  // logic to fetch details about the specified health condition from database or an external API
  const conditionDetails = getConditionDetails(conditionId);

  if (conditionDetails) {
    res.json({ conditionId, conditionDetails });
  } else {
    res.status(404).json({ error: 'Condition not found' });
  }
});

// Function to get details about a health condition

function getConditionDetails(conditionId) {
  let db = new sqlite3.Database('./db/healthcare.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the healthcare database.');
  });

  db.serialize(() => {
    db.each(`SELECT * FROM conditions WHERE id = ?`, [conditionId], (err, row) => {
      if (err) {
        console.error(err.message);
      }
      return row;
    });
  });

  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
  });
}

// Start the server
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = { app, server};
