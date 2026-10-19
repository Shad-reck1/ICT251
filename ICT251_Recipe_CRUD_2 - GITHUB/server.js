require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "recipes.db");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    instructions TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    prep_time INTEGER NOT NULL DEFAULT 0,
    cook_time INTEGER NOT NULL DEFAULT 0,
    servings INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function getColumns() {
  return db.prepare("PRAGMA table_info(recipes)").all().map(column => column.name);
}

// Add missing columns if an earlier version of the database exists.
const existingColumns = getColumns();

const migrations = {
  category: "TEXT NOT NULL DEFAULT 'Other'",
  prep_time: "INTEGER NOT NULL DEFAULT 0",
  cook_time: "INTEGER NOT NULL DEFAULT 0",
  servings: "INTEGER NOT NULL DEFAULT 1",
  created_at: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
  updated_at: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
};

for (const [column, definition] of Object.entries(migrations)) {
  if (!existingColumns.includes(column)) {
    db.exec(`ALTER TABLE recipes ADD COLUMN ${column} ${definition}`);
  }
}

const recipeCount = db.prepare("SELECT COUNT(*) AS total FROM recipes").get().total;

if (recipeCount === 0) {
  const insert = db.prepare(`
    INSERT INTO recipes
      (title, ingredients, instructions, category, prep_time, cook_time, servings)
    VALUES
      (@title, @ingredients, @instructions, @category, @prep_time, @cook_time, @servings)
  `);

  const sampleRecipes = [
    {
      title: "Zambian Nshima with Vegetables",
      ingredients: "Mealie meal, water, rape, tomatoes, onion, salt",
      instructions: "Prepare nshima with mealie meal and water. Cook the vegetables with onion and tomatoes, then serve together.",
      category: "Main Course",
      prep_time: 10, cook_time: 30, servings: 4
    },
    {
      title: "Tomato and Egg Breakfast",
      ingredients: "Eggs, tomatoes, onion, cooking oil, salt",
      instructions: "Fry onion and tomatoes. Add beaten eggs and cook until set.",
      category: "Breakfast",
      prep_time: 5, cook_time: 10, servings: 2
    },
    {
      title: "Chicken Stew",
      ingredients: "Chicken, tomatoes, onion, garlic, cooking oil, salt",
      instructions: "Brown the chicken. Add onion, garlic and tomatoes, then simmer until the chicken is thoroughly cooked.",
      category: "Main Course",
      prep_time: 15, cook_time: 40, servings: 4
    },
    {
      title: "Vegetable Rice",
      ingredients: "Rice, carrots, peas, onion, oil, salt",
      instructions: "Cook the rice. Sauté the vegetables, mix them with the rice and heat through.",
      category: "Lunch",
      prep_time: 10, cook_time: 20, servings: 3
    },
    {
      title: "Banana Pancakes",
      ingredients: "Bananas, flour, eggs, milk, baking powder",
      instructions: "Mash the bananas and mix with the other ingredients. Cook small portions on a lightly oiled pan.",
      category: "Breakfast",
      prep_time: 10, cook_time: 15, servings: 3
    },
    {
      title: "Bean Stew",
      ingredients: "Beans, tomatoes, onion, garlic, oil, salt",
      instructions: "Boil the beans until tender. Cook with onion, garlic and tomatoes until the flavours combine.",
      category: "Main Course",
      prep_time: 10, cook_time: 50, servings: 4
    },
    {
      title: "Fresh Fruit Salad",
      ingredients: "Bananas, apples, oranges, seasonal fruit",
      instructions: "Wash and cut the fruit into bite-sized pieces. Mix and serve fresh.",
      category: "Dessert",
      prep_time: 15, cook_time: 0, servings: 4
    },
    {
      title: "Garlic Fried Potatoes",
      ingredients: "Potatoes, garlic, cooking oil, salt, black pepper",
      instructions: "Cut potatoes into pieces. Fry until golden and cooked through, then season with garlic, salt and pepper.",
      category: "Side Dish",
      prep_time: 10, cook_time: 20, servings: 3
    },
    {
      title: "Peanut Butter Porridge",
      ingredients: "Mealie meal, water, peanut butter, sugar (optional)",
      instructions: "Cook the mealie meal with water while stirring. Mix in peanut butter and cook until smooth.",
      category: "Breakfast",
      prep_time: 5, cook_time: 15, servings: 2
    },
    {
      title: "Simple Vegetable Soup",
      ingredients: "Carrots, cabbage, tomatoes, onion, water, salt",
      instructions: "Chop the vegetables, add to water and simmer until tender. Season to taste.",
      category: "Soup",
      prep_time: 15, cook_time: 25, servings: 4
    }
  ];

  const seed = db.transaction(recipes => {
    for (const recipe of recipes) insert.run(recipe);
  });

  seed(sampleRecipes);
}

// Helpers
function validateRecipe(body) {
  const textFields = ["title", "ingredients", "instructions"];
  for (const field of textFields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return `${field} must be a non-empty string.`;
    }
  }

  if (body.category !== undefined &&
      (typeof body.category !== "string" || !body.category.trim())) {
    return "category must be a non-empty string.";
  }

  for (const field of ["prep_time", "cook_time", "servings"]) {
    if (body[field] !== undefined &&
        (!Number.isInteger(Number(body[field])) ||
         Number(body[field]) < (field === "servings" ? 1 : 0))) {
      return `${field} must be a valid non-negative integer${field === "servings" ? " greater than zero" : ""}.`;
    }
  }

  return null;
}

function normaliseRecipe(body) {
  return {
    title: body.title.trim(),
    ingredients: body.ingredients.trim(),
    instructions: body.instructions.trim(),
    category: body.category === undefined ? "Other" : body.category.trim(),
    prep_time: body.prep_time === undefined ? 0 : Number(body.prep_time),
    cook_time: body.cook_time === undefined ? 0 : Number(body.cook_time),
    servings: body.servings === undefined ? 1 : Number(body.servings)
  };
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// API: health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Recipe API is running." });
});

// API: get all recipes
app.get("/api/recipes", (req, res) => {
  const recipes = db.prepare("SELECT * FROM recipes ORDER BY id DESC").all();
  res.json(recipes);
});

// API: get one recipe
app.get("/api/recipes/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid recipe ID." });

  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });

  res.json(recipe);
});

// API: create recipe
app.post("/api/recipes", (req, res) => {
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Send the request body as JSON." });
  }

  const error = validateRecipe(req.body);
  if (error) return res.status(400).json({ error });

  const recipe = normaliseRecipe(req.body);

  const result = db.prepare(`
    INSERT INTO recipes
      (title, ingredients, instructions, category, prep_time, cook_time, servings)
    VALUES
      (@title, @ingredients, @instructions, @category, @prep_time, @cook_time, @servings)
  `).run(recipe);

  const created = db.prepare("SELECT * FROM recipes WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// API: update recipe
app.put("/api/recipes/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid recipe ID." });

  const current = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  if (!current) return res.status(404).json({ error: "Recipe not found." });

  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Send the request body as JSON." });
  }

  const merged = {
    title: req.body.title ?? current.title,
    ingredients: req.body.ingredients ?? current.ingredients,
    instructions: req.body.instructions ?? current.instructions,
    category: req.body.category ?? current.category,
    prep_time: req.body.prep_time ?? current.prep_time,
    cook_time: req.body.cook_time ?? current.cook_time,
    servings: req.body.servings ?? current.servings
  };

  const error = validateRecipe(merged);
  if (error) return res.status(400).json({ error });

  const recipe = normaliseRecipe(merged);

  db.prepare(`
    UPDATE recipes SET
      title = @title,
      ingredients = @ingredients,
      instructions = @instructions,
      category = @category,
      prep_time = @prep_time,
      cook_time = @cook_time,
      servings = @servings,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...recipe, id });

  const updated = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id);
  res.json(updated);
});

// API: delete recipe
app.delete("/api/recipes/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid recipe ID." });

  const result = db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Recipe not found." });
  }

  res.json({ message: "Recipe deleted successfully." });
});

// API: unknown endpoints
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Serve the frontend for the root URL.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle malformed JSON and other errors.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
