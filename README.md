# Project Generator CLI

This CLI tool helps you quickly scaffold a Node.js and Express.js RESTful API project with a pre-defined structure, including a **users API** with JWT authentication.

## Installation

```bash
# Clone this repository
git clone <repository-url>

# Navigate to the project directory
cd <repository-directory>

# Link the CLI globally
npm install -g
```
## Usage

```bash
# Generate a new project
generate-project <project-name>

# Example
generate-project mytiffin

```

## Folder Structure
```
<project-name>
│
├── .env
├── package.json
├── src
│   ├── app.js
│   ├── config
│   │   └── db.js
│   ├── api
│   │   ├── v1
│   │   │   ├── controllers
│   │   │   │   └── userController.js
│   │   │   ├── models
│   │   │   │   └── userModel.js
│   │   │   ├── routes
│   │   │   │   └── userRoutes.js
│   │   │   └── services
│   ├── middlewares
│   │   ├── errorMiddleware.js
│   └── utils
│       ├── AppError.js
│       ├── errorResponse.js
│       └── logger.js


```


## Features

Database Connection:

MongoDB connection setup via db.js.
User Authentication:
    Register, login, and profile routes with JWT-based authentication.
Middleware:
    Authorization middleware (authMiddleware.js).
Environment Variables:
    .env file for configuration.

## Generated endpoints

User Endpoints
Endpoint	            Method	Description
/api/v1/users/register	POST	Register a new user
/api/v1/users/login	    POST	Login and retrieve JWT
/api/v1/users/profile	GET	    Get user profile (protected)

## How to Run the Project
```bash
# Navigate to the project directory
cd <project-name>

# Install dependencies
npm install

# Run the application
npm start

# Development mode with nodemon
npm run dev
```