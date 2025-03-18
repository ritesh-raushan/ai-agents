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
    const [result] = await db.insert(todosTable).values({ todo }).returning(todosTable.id);
    return result?.id || null;
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
You must strictly follow the JSON output format.

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
{"type": "plan", "plan": "I will try to get more context on what user needs to shop"}
{"type": "output", "output": "Can you tell me what all items you want to shop for?"}
{"type": "user", "user": "I want to shop for Apples, Bananas and Oranges"}
{"type": "plan", "plan": "I will use createTodo tool to create a new Todo in the database"}
{"type": "action", "function": "createTodo", "input": "Shopping for Apples, Bananas and Oranges"}
{"type": "observation", "observation": "2"}
{"type": "output", "output": "Your todo has been added successfully"}
]
\`\`\`
`
async function handleUserPrompt(userPrompt) {
    let conversation = [{ type: "user", user: userPrompt }];

    while (true) {
        const prompt = SYSTEM_PROMPT + JSON.stringify(conversation);
        const result = await model.generateContent(prompt);

        let responseText = result.response.text().trim();

        // Remove Markdown Code Blocks if present
        responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");

        let response;
        try {
            response = JSON.parse(responseText);
        } catch (error) {
            console.error("Error parsing JSON response:", error);
            console.error("Raw response:", responseText);
            return;
        }

        conversation.push(response);

        if (response.type === "plan") {
            console.log("AI Plan:", response.plan);
        }

        if (response.type === "action") {
            console.log("Executing:", response.function, response.input);
            if (response.function in tools) {
                try {
                    const observation = await tools[response.function](response.input);
                    conversation.push({ type: "observation", observation });
                } catch (error) {
                    console.error(`Error executing ${response.function}:`, error);
                    conversation.push({ type: "observation", observation: "Error occurred" });
                }
            } else {
                console.error("Unknown function:", response.function);
                conversation.push({ type: "observation", observation: "Invalid function" });
            }
        }

        if (response.type === "output") {
            console.log("AI:", response.output);
            break;
        }
    }
}

console.log("Welcome to AI To-Do Assistant!");
while (true) {
    const userInput = readLineSync.question("You: ");
    if (userInput.toLowerCase() === "exit") break;
    await handleUserPrompt(userInput);
}
