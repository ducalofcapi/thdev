require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

// Usa DATA_DIR se configurado. Caso contrário, cria ./data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

const sessions = new Set();

/* ==============================
   ARMAZENAMENTO
============================== */

function initializeStorage() {
    try {
        // Cria a pasta automaticamente
        fs.mkdirSync(DATA_DIR, { recursive: true });

        console.log("[STORAGE] Diretório:", DATA_DIR);

        // Cria o arquivo apenas se ele ainda não existir
        if (!fs.existsSync(PROJECTS_FILE)) {
            fs.writeFileSync(
                PROJECTS_FILE,
                JSON.stringify({ projects: [] }, null, 2),
                { encoding: "utf8", flag: "wx" }
            );

            console.log("[STORAGE] projects.json criado.");
        }

        // Verifica se o arquivo é válido
        const data = JSON.parse(
            fs.readFileSync(PROJECTS_FILE, "utf8")
        );

        if (!data || !Array.isArray(data.projects)) {
            throw new Error("Estrutura inválida em projects.json");
        }

        console.log("[STORAGE] Inicialização concluída.");
        console.log("[STORAGE] Arquivo:", PROJECTS_FILE);
        console.log("[STORAGE] Projetos encontrados:", data.projects.length);

    } catch (error) {
        console.error("[STORAGE] Erro ao inicializar:", error);
        throw error;
    }
}

function readProjects() {
    try {
        const data = JSON.parse(
            fs.readFileSync(PROJECTS_FILE, "utf8")
        );

        if (!Array.isArray(data.projects)) {
            throw new Error("Lista de projetos inválida.");
        }

        return data.projects;

    } catch (error) {
        console.error("[STORAGE] Erro ao ler projetos:", error);
        throw error;
    }
}

function saveProjects(projects) {
    const tempFile = PROJECTS_FILE + ".tmp";

    try {
        const data = {
            projects
        };

        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tempFile, PROJECTS_FILE);

        console.log("[STORAGE] Projetos salvos:", projects.length);

    } catch (error) {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        console.error("[STORAGE] Erro ao salvar:", error);
        throw error;
    }
}

// Inicializa o armazenamento antes de iniciar o servidor
initializeStorage();

/* ==============================
   MIDDLEWARE
============================== */

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

/* ==============================
   AUTENTICAÇÃO
============================== */

function auth(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Não autorizado."
        });
    }

    const token = authorization.slice(7);

    if (!sessions.has(token)) {
        return res.status(401).json({
            error: "Sessão inválida ou expirada."
        });
    }

    next();
}

/* ==============================
   ROTAS PRINCIPAIS
============================== */

app.get("/", (req, res) => {
    res.json({
        status: "online",
        name: "ThDev Portfolio API"
    });
});

/* ==============================
   LOGIN
============================== */

app.post("/api/login", (req, res) => {
    const { password } = req.body;

    if (!ADMIN_KEY) {
        console.error("[AUTH] ADMIN_KEY não configurada.");

        return res.status(500).json({
            error: "Configuração do servidor incompleta."
        });
    }

    if (!password || password !== ADMIN_KEY) {
        return res.status(401).json({
            error: "Senha incorreta."
        });
    }

    const token = crypto.randomBytes(32).toString("hex");

    sessions.add(token);

    console.log("[LOGIN] Nova sessão criada.");

    res.json({
        success: true,
        token
    });
});

/* ==============================
   VERIFICAR SESSÃO
============================== */

app.get("/api/auth", auth, (req, res) => {
    res.json({
        authenticated: true
    });
});

/* ==============================
   LOGOUT
============================== */

app.post("/api/logout", auth, (req, res) => {
    const token = req.headers.authorization.slice(7);

    sessions.delete(token);

    console.log("[LOGOUT] Sessão encerrada.");

    res.json({
        success: true
    });
});

/* ==============================
   LISTAR PROJETOS
============================== */

app.get("/api/projects", (req, res) => {
    try {
        const projects = readProjects();

        res.setHeader("Cache-Control", "no-store");

        res.json({
            projects
        });

    } catch (error) {
        res.status(500).json({
            error: "Não foi possível carregar os projetos."
        });
    }
});

/* ==============================
   ADICIONAR PROJETO
============================== */

app.post("/api/projects", auth, (req, res) => {
    try {
        const { title, type, image, description } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof image !== "string" ||
            !image.trim()
        ) {
            return res.status(400).json({
                error: "Título e imagem são obrigatórios."
            });
        }

        const projects = readProjects();

        const project = {
            id: Date.now(),
            title: title.trim(),
            type: typeof type === "string" ? type.trim() : "",
            image: image.trim(),
            description: typeof description === "string"
                ? description.trim()
                : ""
        };

        projects.unshift(project);

        saveProjects(projects);

        console.log("[PROJECT] Adicionado:", project.title);

        res.status(201).json({
            success: true,
            project
        });

    } catch (error) {
        console.error("[PROJECT] Erro ao adicionar:", error);

        res.status(500).json({
            error: "Não foi possível adicionar o projeto."
        });
    }
});

/* ==============================
   EXCLUIR PROJETO
============================== */

app.delete("/api/projects/:id", auth, (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isFinite(id)) {
            return res.status(400).json({
                error: "ID inválido."
            });
        }

        const projects = readProjects();

        const updatedProjects = projects.filter(
            project => project.id !== id
        );

        if (updatedProjects.length === projects.length) {
            return res.status(404).json({
                error: "Projeto não encontrado."
            });
        }

        saveProjects(updatedProjects);

        console.log("[PROJECT] Excluído:", id);

        res.json({
            success: true
        });

    } catch (error) {
        console.error("[PROJECT] Erro ao excluir:", error);

        res.status(500).json({
            error: "Não foi possível excluir o projeto."
        });
    }
});

/* ==============================
   ROTA NÃO ENCONTRADA
============================== */

app.use("/api", (req, res) => {
    res.status(404).json({
        error: "Rota não encontrada."
    });
});

/* ==============================
   INICIAR SERVIDOR
============================== */

app.listen(PORT, "0.0.0.0", () => {
    console.log("--------------------------------");
    console.log("ThDev Portfolio rodando na porta", PORT);
    console.log("API: http://localhost:" + PORT);
    console.log("Storage:", DATA_DIR);
    console.log("--------------------------------");
});
