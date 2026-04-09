const axios = require('axios');

async function run() {
    console.log('Sending clear request to localhost:5000...');
    try {
        const res = await axios.post('http://127.0.0.1:5000/api/auth/clear-db');
        console.log('Server response:', res.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

run();
