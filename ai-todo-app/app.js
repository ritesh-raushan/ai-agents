import { GoogleGenerativeAI } from "@google/generative-ai";
import { ilike, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import readLineSync from "readline-sync";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

async function getAllTodos() {
    return await db.select().from(todosTable);
}

async function createTodo(todo) {
    try {
        const result = await db.insert(todosTable).values({
            todo: todo,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning('id');
        return result[0].id;
    } catch (error) {
        console.error("Error creating todo:", error);
        throw error;
    }
}

async function deleteTodoById(id) {
    return await db.delete(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(search) {
    return await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
}

const tools = { getAllTodos, createTodo, deleteTodoById, searchTodo };

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the action with appropriate tools and wait for the Observation based on Action.
Once you get the Observation, Return the AI response based on START prompt and observations.

You can manage tasks by adding, viewing, updating, and deleting them.
You must strictly follow the JSON output format and ALWAYS use the appropriate tool before confirming any action.

For greetings like "hi" or "hello", respond with a helpful message about what you can do.

IMPORTANT: 
- When adding a todo, you MUST use the createTodo tool before confirming.
- When deleting a todo, you MUST use the deleteTodoById tool before confirming.
- When searching todos, you MUST use the searchTodo tool before responding.
- When listing todos, you MUST use the getAllTodos tool before responding.
- For greetings, do not use any tools, just provide a helpful introduction.

You must return only valid JSON without any additional text or formatting.

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
\`\`\`
[
{"type": "user", "user": "Add a task for shopping groceries"}
{"type": "plan", "plan": "I will create a new todo for shopping groceries"}
{"type": "action", "function": "createTodo", "input": "Shopping groceries"}
{"type": "observation", "observation": "2"}
{"type": "output", "output": "Your todo 'Shopping groceries' has been added successfully"}
]
\`\`\`
`;

async function handleUserPrompt(userPrompt) {
    let conversation = [{ type: "user", user: userPrompt }];

    const prompt = SYSTEM_PROMPT + JSON.stringify(conversation);
    const result = await model.generateContent(prompt);

    let responseText = result.response.text().trim();
    responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");
    
    const lastJsonMatch = responseText.match(/\[(?:[^[\]]*|\[(?:[^[\]]*|\[[^[\]]*\])*\])*\](?!.*\[)/);
    if (!lastJsonMatch) {
        console.error("No valid JSON array found in response");
        return;
    }
    responseText = lastJsonMatch[0];

    try {
        const response = JSON.parse(responseText);
        
        // Process each message in the response
        for (const message of response) {
            if (message.type === "action") {
                // Execute the tool and get the result
                let result;
                if (message.function === "createTodo") {
                    result = await createTodo(message.input);
                } else if (message.function === "deleteTodoById") {
                    result = await deleteTodoById(message.input);
                } else if (message.function === "getAllTodos") {
                    result = await getAllTodos();
                } else if (message.function === "searchTodo") {
                    result = await searchTodo(message.input);
                }
                console.log("Tool execution result:", result);
            }
            // Only log the final output message
            if (message.type === "output") {
                console.log("AI:", message.output);
            }
        }

    } catch (error) {
        console.error("Error processing response:", error);
        console.error("Raw response:", responseText);
        return;
    }
}

console.log("Welcome to AI To-Do Assistant!");
while (true) {
    const userInput = readLineSync.question("You: ");
    if (userInput.toLowerCase() === "exit") break;
    await handleUserPrompt(userInput);
}
