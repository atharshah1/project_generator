#!/usr/bin/env node


import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import chalk from 'chalk';

// Initialize Commander
const program = new Command();

// Function to create a file with content
const createFile = (filePath, content) => {
  fs.writeFileSync(filePath, content.trim(), { encoding: 'utf8', flag: 'w' });
  console.log(chalk.green(`✔️  Created: ${filePath}`));
};

// Function to create the project structure
const createProjectStructure = (projectName) => {
  const rootDir = path.join(process.cwd(), projectName);

  console.log(chalk.blue(`\nGenerating project structure for: ${projectName}\n`));

  // Define directories to be created
  const dirs = [
    'src',
    'src/api/v1/controllers',
    'src/api/v1/models',
    'src/api/v1/routes',
    'src/middlewares',
    'src/utils',
    'src/config',
    'tests/unit/controllers',
    'tests/unit/services',
    'tests/integration/routes'
  ];

  // Create all directories
  dirs.forEach((dir) => mkdirp.sync(path.join(rootDir, dir)));

  // Create middleware and utility files for error handling
  createFile(
    path.join(rootDir, 'src/middlewares/errorMiddleware.js'),
    `
import { AppError } from '../utils/AppError.js';
import { errorResponse } from '../utils/errorResponse.js';

const errorMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new AppError(message, 400);
  }

  if (err.code === 11000) {
    const message = 'Duplicate field value entered.';
    error = new AppError(message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token has expired. Please log in again.';
    error = new AppError(message, 401);
  }

  errorResponse(res, error.statusCode || 500, error.message || 'Server Error');
};

export default errorMiddleware;
    `
  );

  createFile(
    path.join(rootDir, 'src/utils/AppError.js'),
    `
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export { AppError };
    `
  );

  createFile(
    path.join(rootDir, 'src/utils/errorResponse.js'),
    `
const errorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

export { errorResponse };
    `
  );

  // Create JWT utility
  createFile(
    path.join(rootDir, 'src/utils/jwtUtils.js'),
    `
import jwt from 'jsonwebtoken';

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};
    `
  );

  // Create Authentication middleware
  createFile(
    path.join(rootDir, 'src/middlewares/authMiddleware.js'),
    `
import jwt from 'jsonwebtoken';
import { User } from '../api/v1/models/userModel.js';
import { AppError } from '../utils/AppError.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      return next(new AppError('Not authorized, token failed', 401));
    }
  }

  if (!token) {
    return next(new AppError('Not authorized, no token', 401));
  }
};
    `
  );

  // Create main app file
  createFile(
    path.join(rootDir, 'src/app.js'),
    `
import express from 'express';
import mongoose from 'mongoose';
import userRoutes from './api/v1/routes/userRoutes.js';
import errorMiddleware from './middlewares/errorMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware for parsing JSON request body
app.use(express.json());

// Routes
app.use('/api/v1/users', userRoutes);

// Error handling middleware should be last
app.use(errorMiddleware);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error: ', err));

export default app;
    `
  );

  // Create server file
  createFile(
    path.join(rootDir, 'src/server.js'),
    `
import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
    `
  );

  // Create user routes
  createFile(
    path.join(rootDir, 'src/api/v1/routes/userRoutes.js'),
    `
import express from 'express';
import { registerUser, loginUser, getUserProfile } from '../controllers/userController.js';
import { protect } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);

export default router;
    `
  );

  // Create user controller
  createFile(
    path.join(rootDir, 'src/api/v1/controllers/userController.js'),
    `
import { User } from '../models/userModel.js';
import { generateToken } from '../../utils/jwtUtils.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/AppError.js';

// Register a new user
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists', 400));
    }

    // Create new user
    const newUser = await User.create({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        token: generateToken(newUser._id),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Authenticate user and get token
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get user profile (protected)
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json({
        success: true,
        data: user,
      });
    } else {
      return next(new AppError('User not found', 404));
    }
  } catch (err) {
    next(err);
  }
};
    `
  );

  // Create user model
  createFile(
    path.join(rootDir, 'src/api/v1/models/userModel.js'),
    `
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

export const User = mongoose.model('User', userSchema);
    `
  );

  // Create config/db.js
  createFile(
    path.join(rootDir, 'src/config/db.js'),
    `
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
};
    `
  );

  // Create server entry point
  createFile(
    path.join(rootDir, 'src/server.js'),
    `
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Start Server
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
    `
  );

  // Create package.json for the generated project
  createFile(
    path.join(rootDir, 'package.json'),
    `
{
  "name": "${projectName}",
  "version": "1.0.0",
  "description": "A Node.js and Express.js RESTful API project with JWT authentication and error handling.",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1",
    "express": "^4.17.1",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.8.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  },
  "type": "module",
  "author": "Your Name",
  "license": "MIT"
}
    `
  );

  // Create .env file
  createFile(
    path.join(rootDir, '.env'),
    `
PORT=5000
MONGO_URI=mongodb://localhost:27017/${projectName.toLowerCase()}
JWT_SECRET=yourjwtsecretkey
    `
  );

  // Create .gitignore file
  createFile(
    path.join(rootDir, '.gitignore'),
    `
node_modules/
.env
    `
  );

  // Create README.md file
  createFile(
    path.join(rootDir, 'README.md'),
    `
# ${projectName}

A Node.js and Express.js RESTful API project with JWT authentication and centralized error handling.

## Features

- **User Authentication**: Register, login, and profile endpoints with JWT.
- **Error Handling**: Centralized error handling middleware.
- **Database**: MongoDB with Mongoose.
- **Environment Variables**: Managed via \`.env\` file.

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **MongoDB** installed and running

### Installation

1. Navigate to the project directory:
   \`\`\`bash
   cd ${projectName}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   - Edit the \`.env\` file with your configuration.

### Running the Project

- **Development Mode** (with nodemon):
  \`\`\`bash
  npm run dev
  \`\`\`

- **Production Mode**:
  \`\`\`bash
  npm start
  \`\`\`

### API Endpoints

#### User Endpoints

| Endpoint                 | Method | Description                     |
|--------------------------|--------|---------------------------------|
| \`/api/v1/users/register\` | POST   | Register a new user             |
| \`/api/v1/users/login\`    | POST   | Login and retrieve JWT          |
| \`/api/v1/users/profile\`  | GET    | Get user profile (protected)    |

### Usage

After generating the project structure, follow these steps:

1. Navigate to your project folder:
   \`\`\`bash
   cd ${projectName}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Access the API endpoints using tools like [Postman](https://www.postman.com/) or [cURL](https://curl.se/).

## License

This project is licensed under the MIT License.
    `
  );

  console.log(chalk.green(`\n✔️  Project structure for "${projectName}" created successfully!\n`));
};

// Set up CLI using Commander.js
program
  .name('generate-project')
  .description('CLI to generate a Node.js and Express.js project template with JWT authentication and error handling.')
  .version('1.0.0')
  .argument('<project-name>', 'Name of the project to create')
  .action((projectName) => {
    createProjectStructure(projectName);
  });

// Parse the command-line arguments
program.parse(process.argv);
