// 1. Import necessary modules
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const dbService = require('./db-service'); // <-- Imports the DB service

// 2. Initialize Express app
const app = express();
const port = process.env.PORT || 3003;

// --- Session Middleware Setup ---
app.use(session({
    secret: 'a-very-secret-key-that-should-be-in-env-vars',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- Routes ---

// 4. GET route to render the page
app.get('/', (req, res) => {
    const data = req.session.data;
    const error = req.session.error;
    const dbMessage = req.session.dbMessage; // <-- Get DB message from session

    // Clear session data after displaying it
    req.session.data = null;
    req.session.error = null;
    req.session.dbMessage = null;

    res.render('index', { data, error, dbMessage }); // <-- Pass DB message to the view
});


// 5. POST route for file upload and DB insertion
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        req.session.error = 'No file uploaded. Please select a file.';
        return res.redirect('/');
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    // --- This function processes the parsed JSON data ---
    const processAndUpload = async (jsonData) => {
        if (!jsonData || jsonData.length === 0) {
            req.session.error = 'The file is empty or could not be read.';
            return res.redirect('/');
        }

        // IMPORTANT: Specify your target table name here.
        const tableName = 'invMasterAux'; // <-- Replace with your actual table name

        // Call the database service
        const dbResult = dbService.truncateAndInsert(tableName, jsonData);

        // Store the result in the session to be displayed after redirect
        // if (dbResult.success) {
        //     req.session.dbMessage = { type: 'success', text: dbResult.message };            
        //     req.session.data = jsonData; // Optionally, still show the JSON on the page
        // } else {
        //     req.session.dbMessage = { type: 'danger', text: dbResult.message };
        // }

        if (dbResult.success) {
            req.session.dbMessage = { type: 'success', text: dbResult.message };
            req.session.data = jsonData; // Keep this to show data in page

            // Create 'data' directory if it doesn't exist
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Generate filename with current date and time
            // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const timestamp = new Date().toISOString().replace('T', '_').slice(0,16).replace(/:/g, '-');
            const fileName = `data-${timestamp}.json`;
            const filePath = path.join(dataDir, fileName);

            // Write JSON data to file
            fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error saving JSON file:', err);
                } else {
                    console.log(`✅ JSON data saved to ${filePath}`);
                }
            });

        } else {
            req.session.dbMessage = { type: 'danger', text: dbResult.message };
        }
        res.redirect('/');
    };

    try {
        if (fileExtension === '.csv') {
            const jsonData = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => jsonData.push(row))
                .on('end', () => {
                    // fs.unlinkSync(filePath); // Delete temp file
                    processAndUpload(jsonData); // Process the data
                })
                .on('error', (err) => {
                    fs.unlinkSync(filePath);
                    req.session.error = 'Error processing CSV file.';
                    res.redirect('/');
                });

        } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet);
            // fs.unlinkSync(filePath); // Delete temp file
            processAndUpload(jsonData); // Process the data

        } else {
            fs.unlinkSync(filePath);
            req.session.error = 'Unsupported file type.';
            res.redirect('/');
        }
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        req.session.error = 'An unexpected error occurred.';
        res.redirect('/');
    }
});

app.get('/insert', (req, res) => {
    try {
        let data = req.session.data; console.log(data);
    } catch (error) {
        req.session.error = 'An unexpected error occurred.';
        res.redirect('/');
    }
})

// 6. Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
