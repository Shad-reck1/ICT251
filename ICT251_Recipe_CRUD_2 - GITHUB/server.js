const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Database = require("better-sqlite3");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// SQLite database
const db = new Database(path.join(__dirname, "recipes.db"));

// Create the recipes table with the required fields
db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        ingredients TEXT NOT NULL,
        instructions TEXT NOT NULL,
        category TEXT NOT NULL,
        prep_time_minutes INTEGER NOT NULL,
        cook_time_minutes INTEGER NOT NULL,
        servings INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

// Add new fields to an existing database if they are missing
const existingColumns = db.prepare(
    "PRAGMA table_info(recipes)"
).all().map(column => column.name);

const newColumns = [
    ["description", "TEXT NOT NULL DEFAULT ''"],
    ["category", "TEXT NOT NULL DEFAULT 'General'"],
    ["prep_time_minutes", "INTEGER NOT NULL DEFAULT 0"],
    ["cook_time_minutes", "INTEGER NOT NULL DEFAULT 0"],
    ["servings", "INTEGER NOT NULL DEFAULT 1"],
    ["updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"]
];

for (const [column, definition] of newColumns) {
    if (!existingColumns.includes(column)) {
        db.exec(
            `ALTER TABLE recipes ADD COLUMN ${column} ${definition}`
        );
    }
}

// Insert 10 sample recipes only when the table is empty
const recipeCount = db.prepare(
    "SELECT COUNT(*) AS total FROM recipes"
).get().total;

if (recipeCount === 0) {
    const insertRecipe = db.prepare(`
        INSERT INTO recipes (
            title, description, ingredients, instructions,
            category, prep_time_minutes, cook_time_minutes, servings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleRecipes = [
        [
            "Zambian Nshima",
            "A staple maize meal dish.",
            "Maize meal, water",
            "Boil water. Gradually add maize meal while stirring. Cook until firm.",
            "Main Course", 5, 25, 4
        ],
        [
            "Vegetable Rice",
            "Rice cooked with mixed vegetables.",
            "Rice, carrots, peas, onion, oil, salt, water",
            "Cook rice. Fry chopped vegetables and onion, then mix with the rice.",
            "Main Course", 10, 25, 4
        ],
        [
            "Tomato Omelette",
            "A simple egg dish with tomatoes.",
            "Eggs, tomatoes, onion, salt, cooking oil",
            "Beat eggs. Fry chopped tomatoes and onion, add eggs, and cook until set.",
            "Breakfast", 5, 10, 2
        ],
        [
            "Bean Stew",
            "A hearty stew made with beans.",
            "Cooked beans, tomatoes, onion, oil, salt, water",
            "Fry onion and tomatoes. Add beans and water, then simmer until flavours combine.",
            "Main Course", 10, 25, 4
        ],
        [
            "Sweet Potato Mash",
            "Soft mashed sweet potatoes.",
            "Sweet potatoes, water, salt",
            "Boil peeled sweet potatoes until tender, drain, and mash.",
            "Side Dish", 10, 20, 3
        ],
        [
            "Peanut Sauce",
            "A creamy groundnut sauce.",
            "Groundnut paste, water, tomato, onion, salt",
            "Cook onion and tomato. Stir in groundnut paste and water, then simmer while stirring.",
            "Sauce", 10, 20, 4
        ],
        [
            "Pancakes",
            "Soft pancakes for breakfast.",
            "Flour, egg, milk, sugar, baking powder, oil",
            "Mix ingredients into a batter. Pour small portions into a lightly oiled pan and cook both sides.",
            "Breakfast", 10, 15, 4
        ],
        [
            "Cabbage Stir-Fry",
            "Quickly cooked seasoned cabbage.",
            "Cabbage, onion, tomato, oil, salt",
            "Slice the vegetables. Fry onion and tomato, add cabbage, and cook until tender.",
            "Side Dish", 10, 12, 3
        ],
        [
            "Banana Smoothie",
            "A blended banana drink.",
            "Bananas, milk, yoghurt",
            "Blend bananas, milk, and yoghurt until smooth. Serve immediately.",
            "Beverage", 5, 0, 2
        ],
        [
            "Chicken Tomato Stew",
            "Chicken simmered in tomato sauce.",
            "Chicken, tomatoes, onion, oil, salt, water",
            "Cook chicken thoroughly. Prepare a tomato and onion sauce, add the chicken, and simmer until done.",
            "Main Course", 15, 40, 4
        ]
    ];

    const seedRecipes = db.transaction(() => {
        for (const recipe of sampleRecipes) {
            insertRecipe.run(...recipe);
        }
    });

    seedRecipes();
}

// Home route
app.get("/", (req, res) => {
    res.send("Personal Recipe Card API is running.");
});

// GET all recipes
app.get("/api/recipes", (req, res) => {
    try {
        const recipes = db.prepare(
            "SELECT * FROM recipes ORDER BY id DESC"
        ).all();

        res.json(recipes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to retrieve recipes." });
    }
});

// GET one recipe
app.get("/api/recipes/:id", (req, res) => {
    try {
        const recipe = db.prepare(
            "SELECT * FROM recipes WHERE id = ?"
        ).get(req.params.id);

        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found." });
        }

        res.json(recipe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to retrieve recipe." });
    }
});

// Validate recipe input
function validateRecipe(req, res, next) {
    const {
        title, description, ingredients, instructions,
        category, prep_time_minutes, cook_time_minutes, servings
    } = req.body;

    const textFields = {
        title, description, ingredients, instructions, category
    };

    for (const [field, value] of Object.entries(textFields)) {
        if (typeof value !== "string" || !value.trim()) {
            return res.status(400).json({
                error: `${field} must be a non-empty string.`
            });
        }
    }

    for (const [field, value] of Object.entries({
        prep_time_minutes, cook_time_minutes, servings
    })) {
        if (!Number.isInteger(value) || value < 0) {
            return res.status(400).json({
                error: `${field} must be a non-negative integer.`
            });
        }
    }

    if (servings < 1) {
        return res.status(400).json({
            error: "servings must be at least 1."
        });
    }

    next();
}

// CREATE a recipe
app.post("/api/recipes", validateRecipe, (req, res) => {
    try {
        const {
            title, description, ingredients, instructions,
            category, prep_time_minutes, cook_time_minutes, servings
        } = req.body;

        const result = db.prepare(`
            INSERT INTO recipes (
                title, description, ingredients, instructions,
                category, prep_time_minutes, cook_time_minutes, servings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            title.trim(),
            description.trim(),
            ingredients.trim(),
            instructions.trim(),
            category.trim(),
            prep_time_minutes,
            cook_time_minutes,
            servings
        );

        const recipe = db.prepare(
            "SELECT * FROM recipes WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json(recipe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create recipe." });
    }
});

// UPDATE a recipe
app.put("/api/recipes/:id", validateRecipe, (req, res) => {
    try {
        const {
            title, description, ingredients, instructions,
            category, prep_time_minutes, cook_time_minutes, servings
        } = req.body;

        const result = db.prepare(`
            UPDATE recipes
            SET title = ?,
                description = ?,
                ingredients = ?,
                instructions = ?,
                category = ?,
                prep_time_minutes = ?,
                cook_time_minutes = ?,
                servings = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            title.trim(),
            description.trim(),
            ingredients.trim(),
            instructions.trim(),
            category.trim(),
            prep_time_minutes,
            cook_time_minutes,
            servings,
            req.params.id
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: "Recipe not found." });
        }

        const recipe = db.prepare(
            "SELECT * FROM recipes WHERE id = ?"
        ).get(req.params.id);

        res.json(recipe);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update recipe." });
    }
});

// DELETE a recipe
app.delete("/api/recipes/:id", (req, res) => {
    try {
        const result = db.prepare(
            "DELETE FROM recipes WHERE id = ?"
        ).run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Recipe not found." });
        }

        res.json({ message: "Recipe deleted successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete recipe." });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});