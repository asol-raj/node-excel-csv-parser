require('dotenv').config();
// 1. Import the mysql2 library
const mysql = require('mysql2/promise');


// 2. Configure your MySQL connection details
// IMPORTANT: Replace these with your actual database credentials.
// It's best practice to use environment variables for this in production.
const dbConfig_x = {
    host: process.env.DB_HOST, // 'localhost',
    user: process.env.DB_USER, // 'testuser',
    password: process.env.DB_PASSWROD, // '269608Raj$', // <-- Replace with your MySQL password
    database: process.env.DB_DATABASE , //'testdb' // <-- Replace with your database name
};

const dbConfig = {
    host: process.env.MYSQL_HOSTNAME,           // e.g., 'sqlxxx.main-hosting.xx' or IP address
    user: process.env.MYSQL_USERNAME,          // e.g., 'u123456789_youruser'
    password: process.env.MYSQL_PASSWROD,     // The password you set for the database user
    database: process.env.MYSQL_DATABASE,    // e.g., 'u123456789_yourdbname'
    port: 3306,                             // Default MySQL port, typically 3306
    connectionLimit: 10,                   // Max number of connections in the pool
    waitForConnections: true,
};

// 3. Create a connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Truncates a table and inserts new data in a single transaction.
 * @param {string} tableName - The name of the table to update.
 * @param {Array<Object>} data - An array of objects where each object represents a row.
 * @returns {Object} - An object indicating success or failure.
 */
async function truncateAndInsert_(tableName, data) {
    // Check if there is any data to insert
    if (!data || data.length === 0) {
        return { success: false, message: 'No data provided to insert.' };
    }

    let connection;
    try {
        // Get a connection from the pool
        connection = await pool.getConnection();
        console.log('Successfully connected to the database.');

        // Start a transaction
        await connection.beginTransaction();
        console.log('Transaction started.');

        // Step 1: Truncate the table.
        // Using a prepared statement for safety, though it's not strictly necessary for TRUNCATE.
        await connection.query(`TRUNCATE TABLE ??`, [tableName]);
        console.log(`Table '${tableName}' truncated.`);

        // Step 2: Dynamically prepare the INSERT statement.
        // Get column names from the first data object. This assumes all objects have the same keys.
        const columns = Object.keys(data[0]);
        const columnsSql = columns.map(col => `\`${col}\``).join(', '); // Wrap column names in backticks
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ?? (${columnsSql}) VALUES ?`;

        // Convert the array of objects into an array of arrays for bulk insert
        const values = data.map(row => columns.map(col => row[col]));
        
        // Execute the bulk insert query
        await connection.query(sql, [tableName, values]);
        console.log(`${data.length} rows inserted into '${tableName}'.`);

        // If all queries were successful, commit the transaction
        await connection.commit();
        console.log('Transaction committed.');

        return { success: true, message: `Successfully inserted ${data.length} rows into ${tableName}.` };

    } catch (error) {
        // If any error occurs, rollback the transaction
        if (connection) {
            await connection.rollback();
            console.log('Transaction rolled back due to an error.');
        }
        console.error('Database Error:', error);
        return { success: false, message: 'Failed to upload data to the database.', error: error.message };

    } finally {
        // Finally, release the connection back to the pool
        if (connection) {
            connection.release();
            console.log('Database connection released.');
        }
    }
}

async function truncateAndInsert(tableName, data) {
  if (!data?.length) {
    return { success: false, message: 'No data provided to insert.' };
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Step 1: Truncate the table
    await connection.query(`TRUNCATE TABLE ??`, [tableName]);

    // Step 2: Build dynamic INSERT (exclude created_at)
    const columns = Object.keys(data[0]).filter(c => c !== 'created_at');
    const columnsSql = columns.map(c => `\`${c}\``).join(', ');
    const sql = `INSERT INTO ?? (${columnsSql}) VALUES ?`;
    const values = data.map(row => columns.map(c => row[c]));

    await connection.query(sql, [tableName, values]);
    await connection.commit();

    return { success: true, message: `Inserted ${data.length} rows into ${tableName}.` };

  } catch (error) {
    if (connection) await connection.rollback();
    return { success: false, message: 'Failed to upload data.', error: error.message };

  } finally {
    if (connection) connection.release();
  }
}


// 4. Export the function so it can be used in server.js
module.exports = {
    truncateAndInsert
};


/* 

    | Category | Full Form                  | Key Commands                           | Description                |
    | -------- | -------------------------- | -------------------------------------- | -------------------------- |
    | DDL      | Data Definition Language   | `CREATE`, `ALTER`, `DROP`, etc.        | Define database structure  |
    | DML      | Data Manipulation Language | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Work with data             |
    | DCL      | Data Control Language      | `GRANT`, `REVOKE`                      | Control access permissions |
    | TCL      | Transaction Control Lang.  | `COMMIT`, `ROLLBACK`, `SAVEPOINT`      | Manage transactions        |
    | DQL\*    | Data Query Language        | `SELECT`                               | Retrieve data              |

*/