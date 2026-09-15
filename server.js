require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

const PROJECTS_FILE = path.join(
    __dirname,
    "data",
    "projects.json"
);

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
                "ADMIN_KEY não configurada no ambiente."
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

        const token = crypto.randomBytes(32).toString("hex");

        sessions.add(token);

        console.log(
            `[LOGIN] Nova sessão criada`
        );

        res.json({
            success: true,
            token
        });

    } catch (error) {

        console.error(
            "[LOGIN]",
            error
        );

        res.status(500).json({
            error: "Erro interno no login"
        });

    }

});

// ================================
// VALIDAR SESSÃO
// ================================

app.get("/api/auth", authenticated, (req, res) => {

    res.json({
        success: true,
        authenticated: true
    });

});

// ================================
// LOGOUT
// ================================

app.post("/api/logout", authenticated, (req, res) => {

    const authorization = req.headers.authorization;

    const token = authorization
        ?.replace(/^Bearer\s+/i, "");

    if (token) {
        sessions.delete(token);
    }

    res.json({
        success: true
    });

});

// ================================
// BUSCAR PROJETOS
// ================================

app.get("/api/projects", (req, res) => {

    try {

        if (!fs.existsSync(PROJECTS_FILE)) {

            return res.status(404).json({
                error: "projects.json não encontrado"
            });

        }

        const data = fs.readFileSync(
            PROJECTS_FILE,
            "utf8"
        );

        const projects = JSON.parse(data);

        res.json(projects);

    } catch (error) {

        console.error(
            "[PROJECTS GET]",
            error
        );

        res.status(500).json({
            error: "Erro ao ler projects.json"
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

            if (!fs.existsSync(PROJECTS_FILE)) {

                return res.status(404).json({
                    error: "projects.json não encontrado"
                });

            }

            const data = JSON.parse(
                fs.readFileSync(
                    PROJECTS_FILE,
                    "utf8"
                )
            );

            if (!Array.isArray(data.projects)) {

                data.projects = [];

            }

            const {
                title,
                type,
                image,
                description
            } = req.body;

            // ----------------------------
            // VALIDAÇÃO
            // ----------------------------

            if (!title || !image) {

                return res.status(400).json({
                    error: "Título e imagem são obrigatórios"
                });

            }

            // ----------------------------
            // NOVO PROJETO
            // ----------------------------

            const project = {

                id: Date.now(),

                title: String(title).trim(),

                type:
                    type
                        ? String(type).trim()
                        : "Projeto",

                image:
                    String(image).trim(),

                description:
                    description
                        ? String(description).trim()
                        : ""

            };

            // ----------------------------
            // ADICIONAR NO INÍCIO
            // ----------------------------

            data.projects.unshift(project);

            // ----------------------------
            // SALVAR JSON
            // ----------------------------

            fs.writeFileSync(

                PROJECTS_FILE,

                JSON.stringify(
                    data,
                    null,
                    2
                ),

                "utf8"

            );

            console.log(
                `[PROJECT] Adicionado: ${project.title}`
            );

            res.json({

                success: true,

                project

            });

        } catch (error) {

            console.error(
                "[PROJECTS POST]",
                error
            );

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

            if (!fs.existsSync(PROJECTS_FILE)) {

                return res.status(404).json({
                    error: "projects.json não encontrado"
                });

            }

            const data = JSON.parse(
                fs.readFileSync(
                    PROJECTS_FILE,
                    "utf8"
                )
            );

            if (!Array.isArray(data.projects)) {

                data.projects = [];

            }

            const id = String(
                req.params.id
            );

            const oldLength =
                data.projects.length;

            data.projects =
                data.projects.filter(
                    project =>
                        String(project.id) !== id
                );

            // ----------------------------
            // PROJETO NÃO ENCONTRADO
            // ----------------------------

            if (
                data.projects.length ===
                oldLength
            ) {

                return res.status(404).json({
                    error: "Projeto não encontrado"
                });

            }

            // ----------------------------
            // SALVAR
            // ----------------------------

            fs.writeFileSync(

                PROJECTS_FILE,

                JSON.stringify(
                    data,
                    null,
                    2
                ),

                "utf8"

            );

            console.log(
                `[PROJECT] Excluído: ${id}`
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "[PROJECTS DELETE]",
                error
            );

            res.status(500).json({
                error: "Erro ao excluir projeto"
            });

        }

    }
);

// ================================
// 404 API
// ================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            error: "Endpoint não encontrado"
        });

    }
);

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

    }
);
