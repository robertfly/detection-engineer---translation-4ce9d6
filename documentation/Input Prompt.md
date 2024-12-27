**Input: AI-Driven Detection Translation Platform**

# **WHY - Vision & Purpose**

## **1. Purpose & Users**

- Primary Problem Solved: Manual processing of detections when switching SIEMs is extremely time consuming and error prone

- Target Users: Security Operations Teams

- Value Proposition: Automated translation of detections across systems

# **WHAT - Core Requirements**

## **2. Functional Requirements**

### **Core Features**

System must:

- Using GenAI that is custom trained on security detections, translate detections when prompted across different systems, including:

  - Splunk - SPL

  - QRadar

  - SIGMA

  - Microsoft Azure - KQL

  - Palo Alto Networks

  - Crowdstrike NG-SIEM

  - YARA

  - YARA-L

- When a translation isn’t successful, it must be clear in the output on why it did not work

- Translations can be across a single detection or a collection of detections

- System must separately support an integration with GitHub or file upload of detections that can then be translated singularly or in batch

- Accuracy and explainability is more important than speed

### **User Capabilities**

Users must be able to:

- Translate singular or multiple detections across specified systems

- Pull detections into view to translate (GitHub or File uploads)

# **HOW - Planning & Implementation**

## **3. Technical Foundation**

### **Required Stack Components**

- Frontend: Web-based administrative interface

- Backend: RESTful API architecture

- Storage: Secure document storage system

- Translation Engine: Advanced GenAI trained on detections

- Database: Structured storage for application data

- Integration: GitHub

### **System Requirements**

- Performance: None

- Security: None

- Reliability: 99.9% uptime

- Compliance: None

## **4. User Experience**

### **Primary User Flows**

1. One off translation

   - Entry: Translation page on website

   - Steps: Enter detection to translate → select destination language → Click Translate

   - Success: Output of translated detection

   - Alternative: Output of why translation failed with clear indications as to why

2. Batch translation

   - Entry: Batch translation page on website

   - Steps: Click Batch Translate -\> Enter collection of detections to translate -\> Click translate

   - Success: Copy of detections translated into new folder, any failures marked as such with clear explanation of what did not translate over

   - Alternative: Retry mechanism for failed deliveries

### **Core Interfaces**

- Dashboard: Translation options

- Application View: Single Translation, Batch Translation

## **5. Business Requirements**

### **Access Control**

- None

### **Business Rules**

- None

## **6. Implementation Priorities**

### **High Priority (Must Have)**

- Single Translation

- Batch Translation

- GitHub and File Upload to import detections

- Custom GPTs trained on security detections for intelligent translations

- Clear output if translation succeeded or failed - each detection clearly indicated. Accuracy is more important than speed, work can happen offline to ensure better precision.

- Basic web interface for translation

### **Medium Priority (Should Have)**

- None

### **Lower Priority (Nice to Have)**

- None