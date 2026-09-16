const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for direct file upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Static assets
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/assets', express.static(path.join(__dirname, '..', 'dist', 'assets')));
app.use('/sample_reports', express.static(path.join(__dirname, '..', 'sample_reports')));

const { parseClinicalReport } = require('./clinicalAnalyzer');
const { recordScan, getPatientAnalytics } = require('./patientHistoryStore');
const { renderPatientHistoryPage } = require('./patientHistoryPage');

// Text extraction helper
async function extractTextFromBuffer(buffer, mimetype, originalname) {
    const ext = (originalname.split('.').pop() || '').toLowerCase();
    
    if (mimetype === 'application/pdf' || ext === 'pdf') {
        try {
            if (typeof pdfParse === 'function') {
                const data = await pdfParse(buffer);
                return data.text || '';
            } else if (pdfParse.PDFParse) {
                const parser = new pdfParse.PDFParse(new Uint8Array(buffer));
                const res = await parser.getText();
                return res.text || res || '';
            } else {
                const PDFParser = require('pdf-parse').PDFParse || require('pdf-parse');
                const parser = new PDFParser(new Uint8Array(buffer));
                const res = await parser.getText();
                return res.text || res || '';
            }
        } catch (pdfErr) {
            console.error('[Caretaker PDF Parser Error]', pdfErr);
            return buffer.toString('utf-8');
        }
    } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        ext === 'docx' || ext === 'doc'
    ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } else {
        return buffer.toString('utf-8');
    }
}

// ── Root Endpoint ──
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'caretaker.html'));
});

// ── Dedicated Caregiver Live Monitor & Safety Portal ──
app.get('/safety', (_req, res) => {
    res.sendFile(path.join(__dirname, 'caregiverSafety.html'));
});

app.get('/caregiver', (_req, res) => {
    res.sendFile(path.join(__dirname, 'caregiverSafety.html'));
});

app.get('/live-monitor', (_req, res) => {
    res.sendFile(path.join(__dirname, 'caregiverSafety.html'));
});

// ── OCR & Report Analysis Endpoints ──
app.post('/api/ocr/upload', upload.single('reportFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
        if (!extractedText || !extractedText.trim()) {
            return res.status(400).json({ error: 'Could not extract text from document.' });
        }
        const analysis = parseClinicalReport(extractedText);
        if (analysis.patient_summary?.name) {
            recordScan(analysis.patient_summary.name, analysis);
        }
        res.json({ success: true, extractedText, extractedLength: extractedText.length, analysis });
    } catch (err) {
        console.error('[Caretaker OCR Upload Error]', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ocr/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Missing clinical report text' });
        }
        const analysis = parseClinicalReport(text);
        if (analysis.patient_summary?.name) {
            recordScan(analysis.patient_summary.name, analysis);
        }
        res.json({ success: true, analysis });
    } catch (err) {
        console.error('[Caretaker OCR Analyze Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Patient History & 270° Speedometer ──
app.get('/patient-history', (req, res) => {
    const patientName = req.query.name || 'Rajesh K. Verma';
    const analytics = getPatientAnalytics(patientName);
    res.send(renderPatientHistoryPage(analytics));
});

app.get('/patient/:name', (req, res) => {
    const patientName = req.params.name || 'Rajesh K. Verma';
    const analytics = getPatientAnalytics(patientName);
    res.send(renderPatientHistoryPage(analytics));
});

app.get('/api/patient/:name', (req, res) => {
    const patientName = req.params.name;
    res.json(getPatientAnalytics(patientName));
});

// ── Sample & Template Downloads ──
app.get('/api/download/sample-pdf', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Report_Sample.pdf');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Report_Sample.pdf');
    else res.status(404).json({ error: 'Sample PDF not found' });
});

app.get('/api/download/template-pdf', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Report_Template.pdf');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Report_Template.pdf');
    else res.status(404).json({ error: 'Template PDF not found' });
});

app.get('/api/download/sunita-pdf', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Report_Sunita_Sharma.pdf');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Report_Sunita_Sharma.pdf');
    else res.status(404).json({ error: 'Sunita PDF not found' });
});

app.get('/api/download/sunita-followup-pdf', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Report_Sunita_Sharma_FollowUp.pdf');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Report_Sunita_Sharma_FollowUp.pdf');
    else res.status(404).json({ error: 'Sunita Follow-Up PDF not found' });
});

app.get('/api/download/sunita-pptx', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Case_Presentation_Sunita_Sharma.pptx');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Case_Presentation_Sunita_Sharma.pptx');
    else res.status(404).json({ error: 'Sunita Case PPT not found' });
});

app.get('/api/download/worsening-pdf', (_req, res) => {
    const filePath = path.join(__dirname, '..', 'sample_reports', 'Vasundhara_Hospital_Alzheimer_Report_Worsening_Case.pdf');
    if (fs.existsSync(filePath)) res.download(filePath, 'Vasundhara_Hospital_Alzheimer_Report_Worsening_Case.pdf');
    else res.status(404).json({ error: 'Worsening PDF not found' });
});

app.post('/api/caregiver/voice-assist', (req, res) => {
    const { message, sender = 'Caregiver Ananya', patientName = 'Mrs. Sunita Sharma', type = 'wandering_redirection' } = req.body;
    console.log(`[Caretaker Voice Assist] Sending to ${patientName}: "${message}"`);
    if (io) {
        io.emit('caregiver_voice_assist', {
            message,
            sender,
            patientName,
            type,
            timestamp: new Date().toLocaleTimeString()
        });
    }
    
    // Also notify main hub on port 5000 if running
    try {
        const postData = JSON.stringify({ message, sender, patientName, type });
        const request = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/caregiver/voice-assist',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        });
        request.on('error', () => {});
        request.write(postData);
        request.end();
    } catch (e) {}

    res.json({ success: true, delivered: true, message, timestamp: new Date().toLocaleTimeString() });
});

// ── Patient Assist Request Endpoint (e.g., Forgot Where To Go on Outdoor Walk) ──
app.post('/api/patient/assist-request', (req, res) => {
    const {
        patientName = 'Mrs. Sunita Sharma',
        scenario = 'Outside Walk Disorientation — Forgot destination',
        trigger = 'button',
        transcript = 'Patient pressed Outside Walk Assist button',
        location = '14th Cross Rd (72m North-East, Near Park)',
        missingItems = ['Home Keys', 'Walking Stick'],
        timestamp = new Date().toLocaleTimeString()
    } = req.body;

    console.log(`[Caretaker 5174 Alert] 🚨 Patient Assist Request from ${patientName}: ${scenario} (${trigger})`);
    
    const payload = {
        patientName,
        scenario,
        trigger,
        transcript,
        location,
        missingItems,
        timestamp
    };

    if (io) {
        io.emit('patient_assist_request', payload);
    }

    // Cross-forward to Hub on port 5000 if active
    try {
        const postData = JSON.stringify(payload);
        const request = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/patient/assist-request-internal',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        });
        request.on('error', () => {});
        request.write(postData);
        request.end();
    } catch (e) {}

    res.json({ success: true, received: true, payload });
});

app.post('/api/patient/assist-request-internal', (req, res) => {
    if (io) {
        io.emit('patient_assist_request', req.body);
    }
    res.json({ success: true });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Mnemosync Caretaker Portal', port: process.env.CARETAKER_PORT || 5174 });
});

const PORT = process.env.CARETAKER_PORT || 5174;
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log('[Caretaker Socket] Client connected:', socket.id);
    socket.on('patient_assist_request', (data) => {
        console.log('[Caretaker Socket] Relaying patient_assist_request:', data);
        io.emit('patient_assist_request', data);
    });
    socket.on('caregiver_voice_assist', (data) => {
        io.emit('caregiver_voice_assist', data);
    });
});

server.listen(PORT, () => {
    console.log(`\n🛡️ Mnemosync Caretaker Portal running on http://localhost:${PORT}`);
    console.log(`   Direct Link: http://localhost:${PORT}/\n`);
});
