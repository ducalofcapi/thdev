require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

const PROJECTS_FILE = path.join(__dirname, "data", "projects.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Set();

function authenticated(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            error: "Não autorizado"
        });
    }

    next();
}

// Login
app.post("/api/login", (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_KEY) {
        return res.status(401).json({
            error: "Senha incorreta"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");

    sessions.add(token);

    res.json({
        success: true,
        token
    });
});

// Buscar projetos
app.get("/api/projects", (req, res) => {
    try {
        const data = fs.readFileSync(
            PROJECTS_FILE,
            "utf8"
        );

        res.json(JSON.parse(data));
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao ler projects.json"
        });
    }
});

// Adicionar projeto
app.post("/api/projects", authenticated, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(PROJECTS_FILE, "utf8")
        );

        const { title, type, image, description } = req.body;

        if (!title || !image) {
            return res.status(400).json({
                error: "Título e imagem são obrigatórios"
            });
        }

        const project = {
            id: Date.now(),
            title,
            type: type || "Projeto",
            image,
            description: description || ""
        };

        data.projects.unshift(project);

        fs.writeFileSync(
            PROJECTS_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        res.json({
            success: true,
            project
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao salvar projeto"
        });
    }
});

// Excluir projeto
app.delete("/api/projects/:id", authenticated, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(PROJECTS_FILE, "utf8")
        );

        const id = String(req.params.id);

        data.projects = data.projects.filter(
            project => String(project.id) !== id
        );

        fs.writeFileSync(
            PROJECTS_FILE,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        res.json({
            success: true
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao excluir projeto"
        });
    }
});

app.listen(PORT, () => {
    console.log(`ThDev Portfolio rodando em http://localhost:${PORT}`);
});
