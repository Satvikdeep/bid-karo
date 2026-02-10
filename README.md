Bid-Karo 

Event-Driven Real-Time Auction Platform

This project is a full-stack, real-time auction platform built with Node.js, React, PostgreSQL, and Socket.IO. It is designed to provide an instantaneous, synchronized auction experience for all users, where bids are validated and broadcast with low latency.

Core Features
Secure Authentication: A secure Node.js RESTful API handles user registration and login using JSON Web Tokens (JWT).

Item Management: Full CRUD (Create, Read, Update, Delete) functionality for auction items.

Real-Time Bidding: A Node.js backend validates all incoming bids against business logic.

Instantaneous UI Updates: A dynamic React UI subscribes to Socket.IO events, ensuring the current bid and auction status are synchronized for all clients without needing a page refresh.

Data Integrity: A robust relational PostgreSQL schema enforces data integrity.

Bid Audit Trail: The database includes a time-stamped audit trail for all bids, providing a complete history for every item.

Technology Stack
Backend
Runtime: Node.js

API: Express.js (RESTful API for item and user management)

Database: PostgreSQL

Authentication: JSON Web Token (JWT)

Real-Time Communication: Socket.IO (for bid validation and broadcasting)

Frontend
Library: React

Real-Time Communication: Socket.IO Client (to subscribe to server events)

Database
Type: Relational (PostgreSQL)

Schema: Designed with relational principles to manage users, items, and a time-stamped bids table to serve as an audit trail.