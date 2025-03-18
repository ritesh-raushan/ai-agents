// import { ilike, eq } from 'drizzle-orm';
// import { db } from './db/index.js';
// import { todosTable } from './db/schema.js';
// import OpenAI from 'openai';
// import readLineSync from 'readline-sync';

// const client = new OpenAI();

// async function getAllTodos() {
//     const todos  = await db.select(). from(todosTable);
//     return todos;
// }

// async function createTodo(todo) {
//     const [result] = await db.insert(todosTable).values({ 
//         todo,
//     }).returning(todosTable.id);
//     return result.id;
// }

// async function deleteTodoBYId(id) {
//     await db.delete(todosTable).where(eq(todosTable.id, id));
// }

// async function searchTodo(search) {
//     const todos = await db.select().from(todosTable).where(todosTable.todo.ilike(`%${search}%`));
//     return todos;
// }

// const tools = {
//     getAllTodos: getAllTodos,
//     createTodo: createTodo,
//     deleteTodoBYId: deleteTodoBYId,
//     searchTodo: searchTodo,
// }

// const SYSTEM_PROMPT = `
// You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation and Output State.
// Wait for the user prompt and first PLAN using available tools.
// After Planning, Take the action with appropriate tools and wait for the Observation based on Action.
// Once you get the Observation, Return the AI response based on START prompt and observations.

// You can manage tasks by adding, viewing, updating and deleting them.
// You must strictly follow the JSON output format.

// Todo DB Schema:
// id: Int and Primary  Key
// todo: String
// createdAt: Date Time
// updatedAt: Date Time

// Available Tools:
// - getAllTodos(): Returns all the Todos from Database
// - createTodo(todo: string): Creates a new Todo in the Database and takes todo as a string and returns the ID of the created Todo.
// - deleteTodoById(id: number): Deletes a Todo by ID given in the Database
// - searchTodo(query: string): Searches for all todos matching the query string using ILIKE operator

// Example:
// START
// {"type": "user", "user": "Add a task for shopping groceries"}
// {"type": "plan", "plan": "I will try to get more context on what user needs to shop"}
// {"type": "output", "output": "Can you tell me what all items you want to shop for?"}
// {"type": "user", "user": "I want to shop for Apples, Bananas and Oranges"}
// {"type": "plan", "plan": "I will use createTodo tool to create a new Todo in the database"}
// {"type": "action", "function": "createTodo", "input": "Shopping for Apples, Bananas and Oranges"}
// {"type": "observation", "observation": "2"}
// {"type": "output", "output": "Yout todo has been addedd successfully"}
// `;

// const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

// while (true) {
//     const query = readLineSync.question('>> ');
//     const userMessage = { 
//         type: 'user', 
//         user: query ,
//     };
//     messages.push({ role: 'user', content: JSON.stringify(userMessage) });

//     while (true) {
//         const chat = await client.chat.completions.create({
//             model: 'gpt-4o',
//             messages: messages,
//             response_format: { type: 'json_object' },
//         });
//         const result = chat.compeltions[0].message.content;
//         messages.push({ role: 'assistant', content: result });

//         const action = JSON.parse(result);

//         if (action.type === 'output') {
//             console.log(`🤖: ${action.output}`);
//             break;
//         } else if (action.type === 'action') {
//             const fn = tools[action.function];
//             if (!fn) throw new Error('Invalid Tool Call');
//             const observation = await fn(action.input);
//             const observationMessage = { type: 'observation', observation: observation };
//             // messages.push({ role: 'developer', content: JSON.stringify(observationMessage) });
//         }
//     }
// }


import { ilike, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { todosTable } from './db/schema.js';
import readLineSync from 'readline-sync';
import OpenAI from "openai";

// Initialize DeepSeek client
const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

async function getAllTodos() {
    const todos = await db.select().from(todosTable);
    return todos;
}

async function createTodo(todo) {
    const [result] = await db.insert(todosTable).values({
        todo,
    }).returning(todosTable.id);
    return result.id;
}

async function deleteTodoById(id) {
    await db.delete(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(search) {
    const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
    return todos;
}

const tools = {
    getAllTodos: getAllTodos,
    createTodo: createTodo,
    deleteTodoById: deleteTodoById,
    searchTodo: searchTodo,
};

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the action with appropriate tools and wait for the Observation based on Action.
Once you get the Observation, Return the AI response based on START prompt and observations.

You can manage tasks by adding, viewing, updating, and deleting them.
You must strictly follow the JSON output format.

Todo DB Schema:
id: Int and Primary Key
todo: String
createdAt: Date Time
updatedAt: Date Time

Available Tools:
- getAllTodos(): Returns all the Todos from Database
- createTodo(todo: string): Creates a new Todo in the Database and takes todo as a string and returns the ID of the created Todo.
- deleteTodoById(id: number): Deletes a Todo by ID given in the Database
- searchTodo(query: string): Searches for all todos matching the query string using ILIKE operator

Example:
START
{"type": "user", "user": "Add a task for shopping groceries"}
{"type": "plan", "plan": "I will try to get more context on what user needs to shop"}
{"type": "output", "output": "Can you tell me what all items you want to shop for?"}
{"type": "user", "user": "I want to shop for Apples, Bananas and Oranges"}
{"type": "plan", "plan": "I will use createTodo tool to create a new Todo in the database"}
{"type": "action", "function": "createTodo", "input": "Shopping for Apples, Bananas and Oranges"}
{"type": "observation", "observation": "2"}
{"type": "output", "output": "Your todo has been added successfully"}
`;

const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

while (true) {
    const query = readLineSync.question('>> ');
    const userMessage = { 
        type: 'user', 
        user: query ,
    };
    messages.push({ role: 'user', content: JSON.stringify(userMessage) });

    while (true) {
        const chat = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: messages,
            response_format: { type: 'json_object' },
        });
        const result = chat.compeltions[0].message.content;
        messages.push({ role: 'assistant', content: result });

        const action = JSON.parse(result);

        if (action.type === 'output') {
            console.log(`🤖: ${action.output}`);
            break;
        } else if (action.type === 'action') {
            const fn = tools[action.function];
            if (!fn) throw new Error('Invalid Tool Call');
            const observation = await fn(action.input);
            const observationMessage = { type: 'observation', observation: observation };
            messages.push({ role: 'developer', content: JSON.stringify(observationMessage) });
        }
    }
}