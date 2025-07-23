// 1. Import necessary modules
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session'); // <-- New import

// 2. Initialize Express app
const app = express();
const port = process.env.PORT || 3002;

// --- Session Middleware Setup (NEW) ---
app.use(session({
    secret: 'a-very-secret-key-that-should-be-in-env-vars', // In production, use an environment variable
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // In production, set to true if using HTTPS
}));

// --- EJS and Layouts Setup ---
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', './layouts/layout');

// --- Static files ---
app.use(express.static('public'));

// 3. Configure Multer for file storage
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- Routes ---

// 4. Update GET route to read from session (MODIFIED)
app.get('/', (req, res) => {
    // Get data and error from session, if they exist
    const data = req.session.data;
    const error = req.session.error;

    // Clear the session data so it doesn't show up on next refresh
    req.session.data = null;
    req.session.error = null;
    
    // Render the page with the data/error from the session
    res.render('index', { data, error });
});


// 5. Update POST route to save to session and redirect (MODIFIED)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        req.session.error = 'No file uploaded. Please select a file.';
        return res.redirect('/'); // Redirect back to the main page
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const jsonData = [];

    try {
        if (fileExtension === '.csv') {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    jsonData.push(row);
                })
                .on('end', () => {
                    fs.unlinkSync(filePath);
                    req.session.data = jsonData; // Save data to session
                    res.redirect('/'); // Redirect back to the main page
                })
                .on('error', (error) => {
                    fs.unlinkSync(filePath);
                    req.session.error = 'Error processing CSV file.';
                    res.redirect('/');
                });

        } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const excelJsonData = xlsx.utils.sheet_to_json(worksheet);

            fs.unlinkSync(filePath);
            req.session.data = excelJsonData; // Save data to session
            res.redirect('/'); // Redirect back to the main page

        } else {
            fs.unlinkSync(filePath);
            req.session.error = 'Unsupported file type. Please upload a CSV or Excel file.';
            res.redirect('/');
        }
    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        req.session.error = 'An unexpected error occurred while processing the file.';
        res.redirect('/');
    }
});

// 6. Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
