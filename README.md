# TradeSphere Protocol

A decentralized, blockchain-based Trade Finance system that modernizes the Letter of Credit (LoC) process using Smart Contracts and a Semaphore-based synchronization model.

## 🚀 Quick Start

### 1. Prerequisite: Installation
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Backend Setup
```bash
cd backend
npm install
# Initialize Database
npx prisma generate
npx prisma db push
# Start development server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Start development server
npm run dev
```

## 🏗️ Technical Architecture

- **Blockchain**: Solidity, Hardhat, Polygon Amoy.
- **Backend**: Node.js, Express (MVC), Prisma (SQLite), JWT, Redis.
- **Frontend**: React, Tailwind CSS v3.4, Axios, Lucide Icons.

## 👥 Roles Supported
The system implements a multi-role approval workflow:
- Importer & Exporter
- Importer Bank & Exporter Bank
- Shipping & Insurance
- Tax Authority, Regulators & Customs

## 📄 License
MIT License. Secure institutional trade finance.
