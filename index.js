const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
dotenv.config()
// Initialize the app
const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/todoApp', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log('Error connecting to MongoDB:', err));

// Set up OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.key // Replace with your OpenAI API key
});

// Define the Todo model
const Todo = mongoose.model('Todo', new mongoose.Schema({
    task: String,
    completed: { type: Boolean, default: false },
}));

// Function to interact with GPT-3 and extract task description
async function parseCommandWithNLP(command) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // You can use a different GPT model
            messages: [{
                role: 'system',
                content: 'You are a helpful assistant that extracts task descriptions from commands. Please return only task without task description'
            }, {
                role: 'user',
                content: command
            }],
        });

        const taskDescription = response.choices[0].message.content.trim();
        return taskDescription;
    } catch (error) {
        console.error('Error with GPT-4 API:', error);
        return null;
    }
}

// Endpoint to handle task addition
app.post('/add-task', async (req, res) => {
    const { command } = req.body; // Assuming the command is sent in the body
    const taskDescription = await parseCommandWithNLP(command);

    if (taskDescription) {
        try {
            const task = new Todo({
                task: taskDescription,
            });
            await task.save();
            res.status(200).send({ message: 'Task added successfully', task });
        } catch (err) {
            res.status(500).send({ message: 'Error adding task', error: err.message });
        }
    } else {
        res.status(400).send({ message: 'Could not identify task. Please try again with a clearer command.' });
    }
});


// Endpoint to handle task retrieval
app.post('/retrieve-tasks', async (req, res) => {
    const { query } = req.body; // The query to retrieve tasks

    const interpretation = await interpretQueryAndRetrieveTasks(query);

    if (!interpretation) {
        return res.status(400).send({ message: 'Could not interpret the query. Please try again with a clearer request.' });
    }

    let tasks;
    try {
        // Translate interpretation into a MongoDB query
        if (interpretation.includes('all tasks')) {
            tasks = await Todo.find(); // Get all tasks
        } else if (interpretation.includes('completed tasks')) {
            tasks = await Todo.find({ completed: true }); // Get completed tasks
        } else if (interpretation.includes('incomplete tasks') || interpretation.includes('pending tasks')) {
            tasks = await Todo.find({ completed: false }); // Get incomplete tasks
        } else {
            tasks = await Todo.find(); // Default fallback (all tasks)
        }

        res.status(200).send({ message: 'Tasks retrieved successfully', tasks });
    } catch (err) {
        res.status(500).send({ message: 'Error retrieving tasks', error: err.message });
    }
});


// Function to interpret the user's query about tasks (retrieve tasks)
async function interpretQueryAndRetrieveTasks(query) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: 'You are a helpful assistant that interprets task retrieval commands. You can retrieve tasks based on filters like "all tasks", "completed tasks", "incomplete tasks", or other task-related queries.'
            }, {
                role: 'user',
                content: query
            }],
        });

        const interpretation = response.choices[0].message.content.trim();
        return interpretation;
    } catch (error) {
        console.error('Error with GPT-4 API:', error);
        return null;
    }
}


// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
