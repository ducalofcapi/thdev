
require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

// ================================
// CONFIGURAÇÕES
// ================================

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

// Diretório persistente
const DATA_DIR = process.env.DATA_DIR ||
    path.join(__dirname, "data");

const PROJECTS_FILE = path.join(
    DATA_DIR,
    "projects.json"
);

// ================================
// INICIALIZAÇÃO DO ARMAZENAMENTO
// ================================

function initializeStorage() {
    try {
        // Cria o diretório caso não exista
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, {
                recursive: true
            });

            console.log("[STORAGE] Diretório criado.");
        }

        // Cria o JSON somente se não existir
        if (!fs.existsSync(PROJECTS_FILE)) {
            fs.writeFileSync(
                PROJECTS_FILE,
                JSON.stringify({
                    projects: []
                }, null, 2),
                "utf8"
            );

            console.log("[STORAGE] projects.json criado.");
        }

        // Verifica se o arquivo é válido
        const data = JSON.parse(
            fs.readFileSync(PROJECTS_FILE, "utf8")
        );

        if (!data || !Array.isArray(data.projects)) {
            throw new Error(
                "Estrutura inválida em projects.json"
            );
        }

        console.log("[STORAGE] Armazenamento carregado.");
        console.log(`[STORAGE] Arquivo: ${PROJECTS_FILE}`);
        console.log(`[STORAGE] Projetos: ${data.projects.length}`);

    } catch (error) {
        console.error("[STORAGE] Erro:", error);
        throw error;
    }
}

initializeStorage();

// ================================
// MIDDLEWARE
// ================================

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// ================================
// SESSÕES
// ================================

const sessions = new Set();

// ================================
// FUNÇÕES DE ARMAZENAMENTO
// ================================

function readProjects() {
    const data = fs.readFileSync(
        PROJECTS_FILE,
        "utf8"
    );

    const parsed = JSON.parse(data);

    if (!parsed || !Array.isArray(parsed.projects)) {
        throw new Error("Formato inválido de projects.json");
    }

    return parsed;
}

function saveProjects(data) {
    const temporaryFile = PROJECTS_FILE + ".tmp";

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    // Substituição atômica do arquivo
    fs.renameSync(
        temporaryFile,
        PROJECTS_FILE
    );
}

// ================================
// AUTENTICAÇÃO
// ================================

function authenticated(req, res, next) {
    const authorization = req.headers.authorization;

    const token = authorization
        ?.replace(/^Bearer\s+/i, "");

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            error: "Não autorizado"
        });
    }

    next();
}

// ================================
// ROTA PRINCIPAL
// ================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "ThDev Portfolio API online"
    });
});

// ================================
// LOGIN
// ================================

app.post("/api/login", (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                error: "Senha não informada"
            });
        }

        if (!ADMIN_KEY) {
            console.error(
                "[LOGIN] ADMIN_KEY não configurada."
            );

            return res.status(500).json({
                error: "ADMIN_KEY não configurada"
            });
        }

        if (password !== ADMIN_KEY) {
            return res.status(401).json({
                error: "Senha incorreta"
            });
        }

        const token = crypto
            .randomBytes(32)
            .toString("hex");

        sessions.add(token);

        console.log("[LOGIN] Nova sessão criada.");

        res.json({
            success: true,
            token
        });

    } catch (error) {
        console.error("[LOGIN]", error);

        res.status(500).json({
            error: "Erro interno no login"
        });
    }
});

// ================================
// VALIDAR SESSÃO
// ================================

app.get(
    "/api/auth",
    authenticated,
    (req, res) => {
        res.json({
            success: true,
            authenticated: true
        });
    }
);

// ================================
// LOGOUT
// ================================

app.post(
    "/api/logout",
    authenticated,
    (req, res) => {
        const authorization = req.headers.authorization;

        const token = authorization
            ?.replace(/^Bearer\s+/i, "");

        if (token) {
            sessions.delete(token);
        }

        res.json({
            success: true
        });
    }
);

// ================================
// BUSCAR PROJETOS
// ================================

app.get("/api/projects", (req, res) => {
    try {
        const data = readProjects();

        res.json(data);

    } catch (error) {
        console.error("[PROJECTS GET]", error);

        res.status(500).json({
            error: "Erro ao ler projetos"
        });
    }
});

// ================================
// ADICIONAR PROJETO
// ================================

app.post(
    "/api/projects",
    authenticated,
    (req, res) => {
        try {
            const data = readProjects();

            const {
                title,
                type,
                image,
                description
            } = req.body;

            // VALIDAÇÃO
            if (
                typeof title !== "string" ||
                typeof image !== "string" ||
                !title.trim() ||
                !image.trim()
            ) {
                return res.status(400).json({
                    error: "Título e imagem são obrigatórios"
                });
            }

            // NOVO PROJETO
            const project = {
                id: Date.now(),

                title: title.trim(),

                type: type
                    ? String(type).trim()
                    : "Projeto",

                image: image.trim(),

                description: description
                    ? String(description).trim()
                    : ""
            };

            // ADICIONAR NO INÍCIO
            data.projects.unshift(project);

            // SALVAR NO DISCO PERSISTENTE
            saveProjects(data);

            console.log(
                `[PROJECT] Adicionado: ${project.title}`
            );

            res.json({
                success: true,
                project
            });

        } catch (error) {
            console.error("[PROJECTS POST]", error);

            res.status(500).json({
                error: "Erro ao salvar projeto"
            });
        }
    }
);

// ================================
// EXCLUIR PROJETO
// ================================

app.delete(
    "/api/projects/:id",
    authenticated,
    (req, res) => {
        try {
            const data = readProjects();

            const id = String(req.params.id);

            const oldLength = data.projects.length;

            data.projects = data.projects.filter(
                project => String(project.id) !== id
            );

            // PROJETO NÃO ENCONTRADO
            if (data.projects.length === oldLength) {
                return res.status(404).json({
                    error: "Projeto não encontrado"
                });
            }

            // SALVAR ALTERAÇÕES
            saveProjects(data);

            console.log(
                `[PROJECT] Excluído: ${id}`
            );

            res.json({
                success: true
            });

        } catch (error) {
            console.error("[PROJECTS DELETE]", error);

            res.status(500).json({
                error: "Erro ao excluir projeto"
            });
        }
    }
);

// ================================
// 404 API
// ================================

app.use("/api", (req, res) => {
    res.status(404).json({
        error: "Endpoint não encontrado"
    });
});

// ================================
// INICIAR SERVIDOR
// ================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `ThDev Portfolio rodando na porta ${PORT}`
        );

        console.log(
            `API: http://localhost:${PORT}`
        );

        console.log(
            `[STORAGE] Diretório: ${DATA_DIR}`
        );
    }
);
