// 1. Import necessary modules
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const expressLayouts = require('express-ejs-layouts'); // <-- New import

// 2. Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// --- EJS and Layouts Setup (NEW) ---
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', './layouts/layout'); // Sets the default layout file

// --- Static files (for any future CSS/JS) ---
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

// 4. Add a GET route to render the main page (NEW)
app.get('/', (req, res) => {
    // Render the index.ejs file inside the layout
    // We pass initial null values for data and error
    res.render('index', { data: null, error: null });
});


// 5. Modify the upload route to render results on the page
app.post('/upload', upload.single('file'), (req, res) => { // <-- Changed route to /upload
    if (!req.file) {
        // Re-render the page with an error message
        return res.render('index', { data: null, error: 'No file uploaded. Please select a file.' });
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
                    fs.unlinkSync(filePath); // Clean up the uploaded file
                    // Render the page with the parsed data
                    res.render('index', { data: jsonData, error: null });
                })
                .on('error', (error) => {
                    fs.unlinkSync(filePath);
                    res.render('index', { data: null, error: 'Error processing CSV file.' });
                });

        } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const excelJsonData = xlsx.utils.sheet_to_json(worksheet);

            fs.unlinkSync(filePath); // Clean up the uploaded file
            // Render the page with the parsed data
            res.render('index', { data: excelJsonData, error: null });

        } else {
            fs.unlinkSync(filePath);
            res.render('index', { data: null, error: 'Unsupported file type. Please upload a CSV or Excel file.' });
        }
    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.render('index', { data: null, error: 'An unexpected error occurred while processing the file.' });
    }
});

// 6. Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
