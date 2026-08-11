<div align="center">

  <img src="public/favicon.svg" width="80" height="80" alt="Reebow TECH Logo">

  # Reebow TECH Platform

  **Telegram-style Real-time Messaging & Video Call Platform**
  
  Multi-tenant • White-label Ready • Zero-monthly-fee Infrastructure

  [**Quick Start**](#-quick-start) •
  [**Architecture**](#-architecture) •
  [**Deployment**](#-deployment) •
  [**Configuration**](#-configuration) •
  [**API Reference**](#-api-reference) •
  [**Development**](#-development) •
  [**Contributing**](#-contributing)

  [![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-4.7-blue?logo=socket.io)](https://socket.io/)
  [![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/)
  [![PWA-Ready](https://img.shields.io/badge/PWA-Ready-purple?logo=pwa)](https://web.dev/progressive-web-apps/)
  [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
  [![Version](https://img.shields.io/badge/Version-2.0.0-orange)](package.json)

</div>

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (LTS recommended)
- **MongoDB Atlas** free tier cluster (or self-hosted)
- **Git** for version control

### 1-Minute Setup

```bash
# Clone the repository
git clone [https://github.com/your-org/reebow-platform.git](https://github.com/your-org/reebow-platform.git)
cd reebow-platform

# Install dependencies
npm ci --production

# Configure environment
cp .env.example .env
# Edit .env with your values (see Configuration below)

# Start production server
NODE_ENV=production npm start
