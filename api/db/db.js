const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { cleanTranscript } = require('../utils/transcript');

class EnhancedDatabase {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.dbPath = path.join(__dirname, 'data.db');
    }

    async connect() {
        if (this.db) {
            return;
        }

        await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening enhanced database:', err);
                    reject(err);
                } else {
                    console.log('Connected to enhanced SQLite database');
                    resolve();
                }
            });
        });
    }

    async execute(sql, context, options = {}) {
        const { ignoreErrors = [], successMessage } = options;
        await new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    const message = err.message || err.toString();
                    const shouldIgnore = ignoreErrors.some((pattern) => message.includes(pattern));
                    if (shouldIgnore) {
                        console.warn(`⚠️ ${context}: ${message}`);
                        resolve();
                        return;
                    }
                    console.error(`❌ ${context}: ${message}`);
                    console.error(`   SQL: ${sql}`);
                    reject(err);
                } else {
                    if (successMessage) {
                        console.log(successMessage);
                    }
                    resolve();
                }
            });
        });
    }

    async runMigrations() {
        const migrations = [
            {
                name: 'create_call_templates_table',
                sql: `CREATE TABLE IF NOT EXISTS call_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    business_id TEXT,
                    prompt TEXT,
                    first_message TEXT,
                    persona_config TEXT,
                    voice_model TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'create_sms_templates_table',
                sql: `CREATE TABLE IF NOT EXISTS sms_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    content TEXT NOT NULL,
                    metadata TEXT,
                    is_builtin INTEGER DEFAULT 0,
                    created_by TEXT,
                    updated_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'idx_call_templates_name',
                sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_call_templates_name ON call_templates(name)'
            },
            {
                name: 'idx_call_templates_updated_at',
                sql: 'CREATE INDEX IF NOT EXISTS idx_call_templates_updated_at ON call_templates(updated_at)'
            },
            {
                name: 'idx_sms_templates_name',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sms_templates_name ON sms_templates(name)'
            },
            {
                name: 'create_persona_profiles_table',
                sql: `CREATE TABLE IF NOT EXISTS persona_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT UNIQUE NOT NULL,
                    label TEXT NOT NULL,
                    description TEXT,
                    purposes TEXT,
                    default_purpose TEXT,
                    default_emotion TEXT,
                    default_urgency TEXT,
                    default_technical_level TEXT,
                    call_template_id INTEGER,
                    sms_template_name TEXT,
                    metadata TEXT,
                    created_by TEXT,
                    updated_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(call_template_id) REFERENCES call_templates(id)
                )`
            },
            {
                name: 'idx_persona_profiles_slug',
                sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_profiles_slug ON persona_profiles(slug)'
            }
        ];

        for (const migration of migrations) {
            try {
                await this.execute(
                    migration.sql,
                    `migration failed [${migration.name}]`,
                    { successMessage: `✅ Migration applied: ${migration.name}` }
                );
            } catch (error) {
                error.migration = migration.name;
                throw error;
            }
        }
    }

    async initialize() {
        await this.connect();
        await this.runMigrations();
        await this.createEnhancedTables();
        await this.initializeSMSTables();
        this.isInitialized = true;
        console.log('✅ Enhanced database initialization complete');
    }

    async createEnhancedTables() {
        const tables = [
            // Enhanced calls table with comprehensive tracking
            `CREATE TABLE IF NOT EXISTS calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT UNIQUE NOT NULL,
                phone_number TEXT NOT NULL,
                prompt TEXT,
                first_message TEXT,
                user_chat_id TEXT,
                status TEXT DEFAULT 'initiated',
                twilio_status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                ended_at DATETIME,
                duration INTEGER,
                call_summary TEXT,
                ai_analysis TEXT,
                business_context TEXT,
                generated_functions TEXT,
                provider TEXT DEFAULT 'twilio',
                provider_contact_id TEXT,
                provider_metadata TEXT,
                answered_by TEXT,
                error_code TEXT,
                error_message TEXT,
                ring_duration INTEGER,
                answer_delay INTEGER,
                final_outcome TEXT,
                has_input INTEGER DEFAULT 0,
                latest_input_preview TEXT,
                last_input_at DATETIME,
                amd_status TEXT,
                amd_confidence REAL,
                amd_event_at DATETIME,
                was_answered INTEGER DEFAULT 0,
                outcome_notified_at DATETIME
            )`,

            // Enhanced call transcripts table with personality tracking
            `CREATE TABLE IF NOT EXISTS call_transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                speaker TEXT NOT NULL CHECK(speaker IN ('user', 'ai')),
                message TEXT NOT NULL,
                raw_message TEXT,
                clean_message TEXT,
                interaction_count INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                personality_used TEXT,
                adaptation_data TEXT,
                confidence_score REAL,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // Captured DTMF keypad input per call with compliance metadata
            `CREATE TABLE IF NOT EXISTS dtmf_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                stage_key TEXT DEFAULT 'generic',
                masked_digits TEXT NOT NULL,
                encrypted_digits TEXT,
                compliance_mode TEXT DEFAULT 'safe',
                provider TEXT,
                metadata TEXT,
                received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,
            `CREATE TABLE IF NOT EXISTS call_inputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                step INTEGER NOT NULL,
                input_type TEXT NOT NULL CHECK(input_type IN ('speech','digit')),
                value TEXT NOT NULL,
                confidence REAL,
                captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // Add backward compatibility table name
            `CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                speaker TEXT NOT NULL CHECK(speaker IN ('user', 'ai')),
                message TEXT NOT NULL,
                raw_message TEXT,
                clean_message TEXT,
                interaction_count INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                personality_used TEXT,
                adaptation_data TEXT,
                confidence_score REAL,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // Enhanced call states for comprehensive real-time tracking
            `CREATE TABLE IF NOT EXISTS call_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                state TEXT NOT NULL,
                data TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                sequence_number INTEGER,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // Enhanced webhook notifications table with delivery metrics
            `CREATE TABLE IF NOT EXISTS webhook_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                telegram_chat_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'retrying')),
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME,
                delivery_time_ms INTEGER,
                telegram_message_id INTEGER,
                priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // System settings table for runtime configuration
            `CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Notification delivery metrics for analytics - FIXED: Added UNIQUE constraint
            `CREATE TABLE IF NOT EXISTS notification_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                total_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                avg_delivery_time_ms REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, notification_type)
            )`,

            // Service health monitoring logs
            `CREATE TABLE IF NOT EXISTS service_health_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_name TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Call performance metrics
            `CREATE TABLE IF NOT EXISTS call_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                metric_value REAL,
                metric_data TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(call_sid) REFERENCES calls(call_sid)
            )`,

            // Enhanced user sessions tracking - FIXED: Added UNIQUE constraint
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_chat_id TEXT NOT NULL UNIQUE,
                session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_end DATETIME,
                total_calls INTEGER DEFAULT 0,
                successful_calls INTEGER DEFAULT 0,
                failed_calls INTEGER DEFAULT 0,
                total_duration INTEGER DEFAULT 0,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await new Promise((resolve, reject) => {
                this.db.run(table, (err) => {
                    if (err) {
                        console.error('Error creating enhanced table:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        const columnMigrations = [
            { sql: "ALTER TABLE calls ADD COLUMN provider TEXT DEFAULT 'twilio'", column: 'provider' },
            { sql: 'ALTER TABLE calls ADD COLUMN provider_contact_id TEXT', column: 'provider_contact_id' },
            { sql: 'ALTER TABLE calls ADD COLUMN provider_metadata TEXT', column: 'provider_metadata' },
            { sql: "ALTER TABLE calls ADD COLUMN call_type TEXT DEFAULT 'service'", column: 'call_type' },
            { sql: 'ALTER TABLE calls ADD COLUMN business_function TEXT', column: 'business_function' },
            { sql: 'ALTER TABLE calls ADD COLUMN telegram_chat_id TEXT', column: 'telegram_chat_id' },
            { sql: 'ALTER TABLE calls ADD COLUMN bot_webhook_url TEXT', column: 'bot_webhook_url' },
            { sql: 'ALTER TABLE calls ADD COLUMN metadata_json TEXT', column: 'metadata_json' },
            { sql: 'ALTER TABLE calls ADD COLUMN final_outcome TEXT', column: 'final_outcome' },
            { sql: 'ALTER TABLE calls ADD COLUMN has_input INTEGER DEFAULT 0', column: 'has_input' },
            { sql: 'ALTER TABLE calls ADD COLUMN latest_input_preview TEXT', column: 'latest_input_preview' },
            { sql: 'ALTER TABLE calls ADD COLUMN last_input_at DATETIME', column: 'last_input_at' },
            { sql: 'ALTER TABLE calls ADD COLUMN amd_status TEXT', column: 'amd_status' },
            { sql: 'ALTER TABLE calls ADD COLUMN amd_confidence REAL', column: 'amd_confidence' },
            { sql: 'ALTER TABLE calls ADD COLUMN amd_event_at DATETIME', column: 'amd_event_at' },
            { sql: 'ALTER TABLE calls ADD COLUMN was_answered INTEGER DEFAULT 0', column: 'was_answered' },
            { sql: 'ALTER TABLE calls ADD COLUMN outcome_notified_at DATETIME', column: 'outcome_notified_at' },
            { sql: 'ALTER TABLE call_transcripts ADD COLUMN raw_message TEXT', column: 'call_transcripts.raw_message' },
            { sql: 'ALTER TABLE call_transcripts ADD COLUMN clean_message TEXT', column: 'call_transcripts.clean_message' },
            { sql: 'ALTER TABLE transcripts ADD COLUMN raw_message TEXT', column: 'transcripts.raw_message' },
            { sql: 'ALTER TABLE transcripts ADD COLUMN clean_message TEXT', column: 'transcripts.clean_message' }
        ];

        for (const migration of columnMigrations) {
            await new Promise((resolve, reject) => {
                this.db.run(migration.sql, (err) => {
                    if (err) {
                        if (err.message.includes('duplicate column name')) {
                            resolve();
                        } else {
                            console.error(`Error applying column migration for ${migration.column}:`, err);
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                });
            });
        }

        // Create comprehensive indexes for optimal performance
        const indexes = [
            // Call indexes
            'CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_calls_user_chat_id ON calls(user_chat_id)',
            'CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)',
            'CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_calls_twilio_status ON calls(twilio_status)',
            'CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number)',
            // Transcript indexes for both table names
            'CREATE INDEX IF NOT EXISTS idx_transcripts_call_sid ON call_transcripts(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON call_transcripts(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_transcripts_speaker ON call_transcripts(speaker)',
            'CREATE INDEX IF NOT EXISTS idx_transcripts_personality ON call_transcripts(personality_used)',
            'CREATE INDEX IF NOT EXISTS idx_legacy_transcripts_call_sid ON transcripts(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_legacy_transcripts_timestamp ON transcripts(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_legacy_transcripts_speaker ON transcripts(speaker)',

            // DTMF indexes
            'CREATE INDEX IF NOT EXISTS idx_dtmf_call_sid ON dtmf_entries(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_dtmf_stage_key ON dtmf_entries(stage_key)',
            'CREATE INDEX IF NOT EXISTS idx_dtmf_received_at ON dtmf_entries(received_at)',
            
            // State indexes
            'CREATE INDEX IF NOT EXISTS idx_states_call_sid ON call_states(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_states_timestamp ON call_states(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_states_state ON call_states(state)',
            
            // Notification indexes
            'CREATE INDEX IF NOT EXISTS idx_notifications_status ON webhook_notifications(status)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_call_sid ON webhook_notifications(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_type ON webhook_notifications(notification_type)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON webhook_notifications(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_chat_id ON webhook_notifications(telegram_chat_id)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_priority ON webhook_notifications(priority)',
            'CREATE INDEX IF NOT EXISTS idx_call_inputs_call_sid ON call_inputs(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_call_inputs_step ON call_inputs(call_sid, step)',
            
            // Metrics indexes
            'CREATE INDEX IF NOT EXISTS idx_metrics_date ON notification_metrics(date)',
            'CREATE INDEX IF NOT EXISTS idx_metrics_type ON notification_metrics(notification_type)',
            'CREATE INDEX IF NOT EXISTS idx_call_metrics_call_sid ON call_metrics(call_sid)',
            'CREATE INDEX IF NOT EXISTS idx_call_metrics_type ON call_metrics(metric_type)',

            // Settings indexes
            'CREATE INDEX IF NOT EXISTS idx_system_settings_updated ON system_settings(updated_at)',
            
            // Health indexes
            'CREATE INDEX IF NOT EXISTS idx_health_service ON service_health_logs(service_name)',
            'CREATE INDEX IF NOT EXISTS idx_health_timestamp ON service_health_logs(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_health_status ON service_health_logs(status)',
            
            // Session indexes
            'CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON user_sessions(telegram_chat_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_start ON user_sessions(session_start)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity)'
        ];

        for (const index of indexes) {
            await new Promise((resolve, reject) => {
                this.db.run(index, (err) => {
                    if (err && !err.message.includes('already exists')) {
                        console.error('Error creating enhanced index:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        console.log('✅ Enhanced database tables and indexes created successfully');
    }

    // Enhanced call creation with comprehensive metadata
    async createCall(callData) {
        const { 
            call_sid, 
            phone_number, 
            prompt, 
            first_message, 
            user_chat_id, 
            business_context = null,
            generated_functions = null,
            provider = 'twilio',
            provider_contact_id = null,
            provider_metadata = null,
            call_type = 'service',
            business_function = null,
            telegram_chat_id = null,
            bot_webhook_url = null,
            metadata_json = null
        } = callData;
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO calls (
                    call_sid, phone_number, prompt, first_message, 
                    user_chat_id, business_context, generated_functions,
                    provider, provider_contact_id, provider_metadata,
                    call_type, business_function, telegram_chat_id, bot_webhook_url, metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
                call_sid, 
                phone_number, 
                prompt, 
                first_message, 
                user_chat_id, 
                business_context,
                generated_functions,
                provider,
                provider_contact_id,
                provider_metadata ? JSON.stringify(provider_metadata) : null,
                call_type || 'service',
                business_function || null,
                telegram_chat_id || null,
                bot_webhook_url || null,
                metadata_json ? (typeof metadata_json === 'string' ? metadata_json : JSON.stringify(metadata_json)) : null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    // Enhanced status update with comprehensive tracking
    async updateCallStatus(call_sid, status, additionalData = {}) {
        return new Promise((resolve, reject) => {
            let updateFields = ['status = ?'];
            let values = [status];

            if (additionalData.provider_metadata && typeof additionalData.provider_metadata === 'object') {
                additionalData.provider_metadata = JSON.stringify(additionalData.provider_metadata);
            }

            // Handle all possible additional data fields
            const fieldMappings = {
                'started_at': 'started_at',
                'ended_at': 'ended_at', 
                'duration': 'duration',
                'call_summary': 'call_summary',
                'ai_analysis': 'ai_analysis',
                'twilio_status': 'twilio_status',
                'answered_by': 'answered_by',
                'error_code': 'error_code',
                'error_message': 'error_message',
                'ring_duration': 'ring_duration',
                'answer_delay': 'answer_delay',
                'provider': 'provider',
                'provider_contact_id': 'provider_contact_id',
                'provider_metadata': 'provider_metadata',
                'has_input': 'has_input',
                'latest_input_preview': 'latest_input_preview',
                'last_input_at': 'last_input_at',
                'final_outcome': 'final_outcome',
                'amd_status': 'amd_status',
                'amd_confidence': 'amd_confidence',
                'amd_event_at': 'amd_event_at',
                'was_answered': 'was_answered',
                'outcome_notified_at': 'outcome_notified_at'
            };

            Object.entries(fieldMappings).forEach(([key, field]) => {
                if (additionalData[key] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    values.push(additionalData[key]);
                }
            });

            values.push(call_sid);

            const sql = `UPDATE calls SET ${updateFields.join(', ')} WHERE call_sid = ?`;
            
            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getSystemSetting(key) {
        if (!key) {
            return null;
        }
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT value FROM system_settings WHERE key = ?`,
                [key],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row ? row.value : null);
                    }
                }
            );
        });
    }

    async setSystemSetting(key, value) {
        if (!key) {
            throw new Error('System setting key is required');
        }
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO system_settings (key, value, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP`,
                [key, value],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async getSystemSettings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT key, value, updated_at FROM system_settings`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const settings = {};
                        (rows || []).forEach((row) => {
                            settings[row.key] = {
                                value: row.value,
                                updated_at: row.updated_at
                            };
                        });
                        resolve(settings);
                    }
                }
            );
        });
    }

    formatCallTemplate(row) {
        if (!row) return null;
        let personaConfig = null;
        if (row.persona_config) {
            try {
                personaConfig = JSON.parse(row.persona_config);
            } catch (error) {
                console.warn('Failed to parse persona_config for call template:', error);
                personaConfig = null;
            }
        }

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            business_id: row.business_id,
            prompt: row.prompt,
            first_message: row.first_message,
            persona_config: personaConfig,
            voice_model: row.voice_model,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }

    async getCallTemplates() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM call_templates ORDER BY updated_at DESC`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map((row) => this.formatCallTemplate(row)));
                    }
                }
            );
        });
    }

    async getCallTemplateById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM call_templates WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.formatCallTemplate(row));
                    }
                }
            );
        });
    }

    async getCallTemplateByName(name) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM call_templates WHERE name = ?`,
                [name],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.formatCallTemplate(row));
                    }
                }
            );
        });
    }

    async createCallTemplate(templateData) {
        const {
            name,
            description,
            business_id,
            prompt,
            first_message,
            persona_config,
            voice_model
        } = templateData;

        const personaJson = persona_config ? JSON.stringify(persona_config) : null;

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO call_templates (
                name, description, business_id, prompt, first_message, persona_config, voice_model
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

            this.db.run(
                sql,
                [
                    name,
                    description || null,
                    business_id || null,
                    prompt || null,
                    first_message || null,
                    personaJson,
                    voice_model || null
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    }

    async updateCallTemplate(id, updates) {
        const fields = [];
        const values = [];

        const allowedFields = ['name', 'description', 'business_id', 'prompt', 'first_message', 'voice_model'];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updates[field]);
            }
        }

        if (updates.persona_config !== undefined) {
            fields.push(`persona_config = ?`);
            values.push(updates.persona_config ? JSON.stringify(updates.persona_config) : null);
        }

        if (fields.length === 0) {
            return { changes: 0 };
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');

        values.push(id);

        return new Promise((resolve, reject) => {
            const sql = `UPDATE call_templates SET ${fields.join(', ')} WHERE id = ?`;

            this.db.run(sql, values, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async deleteCallTemplate(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM call_templates WHERE id = ?`,
                [id],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    formatPersonaProfile(row) {
        if (!row) return null;

        const safeParse = (value, label) => {
            if (!value) return null;
            try {
                return JSON.parse(value);
            } catch (error) {
                console.warn(`Failed to parse ${label} for persona profile ${row.slug}:`, error);
                return null;
            }
        };

        return {
            id: row.id,
            slug: row.slug,
            label: row.label,
            description: row.description,
            purposes: safeParse(row.purposes, 'purposes'),
            default_purpose: row.default_purpose,
            default_emotion: row.default_emotion,
            default_urgency: row.default_urgency,
            default_technical_level: row.default_technical_level,
            call_template_id: row.call_template_id,
            sms_template_name: row.sms_template_name,
            metadata: safeParse(row.metadata, 'metadata'),
            created_by: row.created_by,
            updated_by: row.updated_by,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }

    async listPersonaProfiles() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM persona_profiles ORDER BY label ASC`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.map((row) => this.formatPersonaProfile(row)));
                    }
                }
            );
        });
    }

    async getPersonaProfileBySlug(slug) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM persona_profiles WHERE slug = ?`,
                [slug],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.formatPersonaProfile(row));
                    }
                }
            );
        });
    }

    async createPersonaProfile(persona) {
        const {
            slug,
            label,
            description,
            purposes,
            default_purpose,
            default_emotion,
            default_urgency,
            default_technical_level,
            call_template_id,
            sms_template_name,
            metadata,
            created_by,
            updated_by
        } = persona;

        const purposesJson = purposes ? JSON.stringify(purposes) : null;
        const metadataJson = metadata ? JSON.stringify(metadata) : null;

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO persona_profiles (
                    slug,
                    label,
                    description,
                    purposes,
                    default_purpose,
                    default_emotion,
                    default_urgency,
                    default_technical_level,
                    call_template_id,
                    sms_template_name,
                    metadata,
                    created_by,
                    updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(
                sql,
                [
                    slug,
                    label,
                    description || null,
                    purposesJson,
                    default_purpose || null,
                    default_emotion || null,
                    default_urgency || null,
                    default_technical_level || null,
                    call_template_id || null,
                    sms_template_name || null,
                    metadataJson,
                    created_by || null,
                    updated_by || created_by || null
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    }

    async updatePersonaProfile(slug, updates) {
        const fields = [];
        const values = [];

        const directFields = [
            'label',
            'description',
            'default_purpose',
            'default_emotion',
            'default_urgency',
            'default_technical_level',
            'call_template_id',
            'sms_template_name',
            'created_by',
            'updated_by'
        ];

        for (const field of directFields) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updates[field]);
            }
        }

        if (updates.purposes !== undefined) {
            fields.push('purposes = ?');
            values.push(updates.purposes ? JSON.stringify(updates.purposes) : null);
        }

        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
        }

        if (fields.length === 0) {
            return { changes: 0 };
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(slug);

        return new Promise((resolve, reject) => {
            const sql = `UPDATE persona_profiles SET ${fields.join(', ')} WHERE slug = ?`;

            this.db.run(sql, values, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async deletePersonaProfile(slug) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM persona_profiles WHERE slug = ?`,
                [slug],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    // Enhanced call state tracking
    async updateCallState(call_sid, state, data = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO call_states (call_sid, state, data, sequence_number)
                VALUES (?, ?, ?, (
                    SELECT COALESCE(MAX(sequence_number), 0) + 1 
                    FROM call_states 
                    WHERE call_sid = ?
                ))
            `);
            
            stmt.run([call_sid, state, data ? JSON.stringify(data) : null, call_sid], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    // Enhanced transcript with personality tracking (supports both table names)
    async addTranscript(transcriptData) {
        const {
            call_sid,
            speaker,
            message,
            interaction_count,
            personality_used = null,
            adaptation_data = null,
            confidence_score = null
        } = transcriptData;

        const rawMessage = message == null ? '' : String(message);
        const cleanMessage = cleanTranscript(rawMessage);
        const storedMessage = cleanMessage || rawMessage;

        return new Promise((resolve, reject) => {
            const insertIntoTable = (tableName) => {
                return new Promise((resolve, reject) => {
                    const stmt = this.db.prepare(`
                        INSERT INTO ${tableName} (
                            call_sid,
                            speaker,
                            message,
                            raw_message,
                            clean_message,
                            interaction_count,
                            personality_used,
                            adaptation_data,
                            confidence_score
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    stmt.run([
                        call_sid,
                        speaker,
                        storedMessage,
                        rawMessage,
                        cleanMessage,
                        interaction_count,
                        personality_used,
                        adaptation_data,
                        confidence_score
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.lastID);
                        }
                    });
                    stmt.finalize();
                });
            };

            Promise.all([
                insertIntoTable('call_transcripts'),
                insertIntoTable('transcripts')
            ])
                .then((results) => resolve(results[0]))
                .catch(reject);
        });
    }

    async saveDtmfEntry(entry) {
        const {
            call_sid,
            stage_key = 'generic',
            masked_digits,
            encrypted_digits = null,
            compliance_mode = 'safe',
            provider = null,
            metadata = null
        } = entry;

        const metadataValue = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO dtmf_entries (call_sid, stage_key, masked_digits, encrypted_digits, compliance_mode, provider, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([call_sid, stage_key, masked_digits, encrypted_digits, compliance_mode, provider, metadataValue], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    async saveCallInput(entry) {
        const {
            call_sid,
            step,
            input_type,
            value,
            confidence = null
        } = entry;

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO call_inputs (call_sid, step, input_type, value, confidence)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run([call_sid, step, input_type, value, confidence], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    async markCallHasInput(call_sid, preview = null, options = {}) {
        if (!call_sid) {
            return false;
        }

        const sanitizedPreview = typeof preview === 'string' && preview.length ? preview : null;
        const timestamp = options.timestamp || new Date().toISOString();

        return new Promise((resolve, reject) => {
            const updates = ['has_input = 1'];
            const values = [];

            if (sanitizedPreview) {
                updates.push('latest_input_preview = ?');
                values.push(sanitizedPreview);
            }

            if (timestamp) {
                updates.push('last_input_at = ?');
                values.push(timestamp);
            }

            const sql = `UPDATE calls SET ${updates.join(', ')} WHERE call_sid = ?`;
            values.push(call_sid);

            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async updateAmdStatus(call_sid, amdStatus = null, options = {}) {
        if (!call_sid) {
            return false;
        }

        return new Promise((resolve, reject) => {
            const updates = [];
            const values = [];

            if (amdStatus !== null && amdStatus !== undefined) {
                updates.push('amd_status = ?');
                values.push(amdStatus);
            }

            if (options.confidence !== undefined) {
                updates.push('amd_confidence = ?');
                values.push(options.confidence);
            }

            updates.push('amd_event_at = ?');
            values.push(options.eventAt || new Date().toISOString());

            if (options.answeredBy) {
                updates.push('answered_by = ?');
                values.push(options.answeredBy);
            }

            if (options.markAnswered) {
                updates.push('was_answered = 1');
            }

            if (updates.length === 0) {
                resolve(true);
                return;
            }

            const sql = `UPDATE calls SET ${updates.join(', ')} WHERE call_sid = ?`;
            values.push(call_sid);

            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async setFinalOutcome(call_sid, outcome, extra = {}) {
        if (!call_sid || !outcome) {
            return false;
        }

        return new Promise((resolve, reject) => {
            const updates = ['final_outcome = ?'];
            const values = [outcome];

            if (extra.outcome_notified_at) {
                updates.push('outcome_notified_at = ?');
                values.push(extra.outcome_notified_at);
            }

            if (extra.has_input !== undefined) {
                updates.push('has_input = ?');
                values.push(extra.has_input ? 1 : 0);
            }

            if (extra.latest_input_preview !== undefined) {
                updates.push('latest_input_preview = ?');
                values.push(extra.latest_input_preview);
            }

            if (extra.answered_by) {
                updates.push('answered_by = ?');
                values.push(extra.answered_by);
            }

            if (extra.twilio_status) {
                updates.push('twilio_status = ?');
                values.push(extra.twilio_status);
            }

            if (extra.was_answered !== undefined) {
                updates.push('was_answered = ?');
                values.push(extra.was_answered ? 1 : 0);
            }

            if (extra.last_input_at) {
                updates.push('last_input_at = ?');
                values.push(extra.last_input_at);
            }

            const sql = `UPDATE calls SET ${updates.join(', ')} WHERE call_sid = ?`;
            values.push(call_sid);

            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getCallInputs(call_sid) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM call_inputs
                WHERE call_sid = ?
                ORDER BY step ASC, captured_at ASC, id ASC
            `;

            this.db.all(sql, [call_sid], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getNextCallInputStep(call_sid) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COALESCE(MAX(step), 0) as max_step FROM call_inputs WHERE call_sid = ?`,
                [call_sid],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve((row?.max_step || 0) + 1);
                    }
                }
            );
        });
    }

    async getCallDtmfEntries(call_sid) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM dtmf_entries
                WHERE call_sid = ?
                ORDER BY received_at ASC, id ASC
            `;

            this.db.all(sql, [call_sid], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getLatestDtmfEntry(call_sid) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM dtmf_entries
                WHERE call_sid = ?
                ORDER BY received_at DESC, id DESC
                LIMIT 1
            `;

            this.db.get(sql, [call_sid], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    // NEW: Get recent calls with transcripts count (REQUIRED FOR API ENDPOINTS)
    async getRecentCalls(limit = 10, offset = 0) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    c.*,
                    COUNT(DISTINCT t.id) as transcript_count,
                    COUNT(DISTINCT d.id) as dtmf_input_count
                FROM calls c
                LEFT JOIN transcripts t ON c.call_sid = t.call_sid
                LEFT JOIN dtmf_entries d ON c.call_sid = d.call_sid
                GROUP BY c.call_sid
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `;

            this.db.all(query, [limit, offset], (err, rows) => {
                if (err) {
                    console.error('Database error in getRecentCalls:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // NEW: Get total calls count (REQUIRED FOR API ENDPOINTS)
    async getCallsCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM calls', (err, row) => {
                if (err) {
                    console.error('Database error in getCallsCount:', err);
                    reject(err);
                } else {
                    resolve(row?.count || 0);
                }
            });
        });
    }

    // Enhanced webhook notification creation with priority
    async createEnhancedWebhookNotification(call_sid, notification_type, telegram_chat_id, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO webhook_notifications (call_sid, notification_type, telegram_chat_id, priority, retry_count)
                VALUES (?, ?, ?, ?, 0)
            `);
            
            stmt.run([call_sid, notification_type, telegram_chat_id, priority], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    // Backward compatibility method
    async createWebhookNotification(call_sid, notification_type, telegram_chat_id) {
        return this.createEnhancedWebhookNotification(call_sid, notification_type, telegram_chat_id, 'normal');
    }

    // Enhanced webhook notification update with delivery metrics
    async updateEnhancedWebhookNotification(id, status, error_message = null, telegram_message_id = null) {
        return new Promise((resolve, reject) => {
            const sent_at = status === 'sent' ? new Date().toISOString() : null;
            
            // Calculate delivery time if we're marking as sent
            if (status === 'sent') {
                this.db.get('SELECT created_at FROM webhook_notifications WHERE id = ?', [id], (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let delivery_time_ms = null;
                    if (row) {
                        const created = new Date(row.created_at);
                        delivery_time_ms = new Date() - created;
                    }
                    
                    const stmt = this.db.prepare(`
                        UPDATE webhook_notifications 
                        SET status = ?, error_message = ?, sent_at = ?, 
                            telegram_message_id = ?, delivery_time_ms = ?
                        WHERE id = ?
                    `);
                    
                    stmt.run([status, error_message, sent_at, telegram_message_id, delivery_time_ms, id], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.changes);
                        }
                    });
                    stmt.finalize();
                });
            } else {
                const stmt = this.db.prepare(`
                    UPDATE webhook_notifications 
                    SET status = ?, error_message = ?, retry_count = retry_count + 1
                    WHERE id = ?
                `);
                
                stmt.run([status, error_message, id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                });
                stmt.finalize();
            }
        });
    }

    // Backward compatibility method
    async updateWebhookNotification(id, status, error_message = null, sent_at = null) {
        return this.updateEnhancedWebhookNotification(id, status, error_message, null);
    }

    // Enhanced pending notifications with priority and retry logic
    async getEnhancedPendingWebhookNotifications(limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    wn.*,
                    c.phone_number, 
                    c.call_summary, 
                    c.ai_analysis,
                    c.status as call_status,
                    c.duration as call_duration,
                    c.twilio_status
                FROM webhook_notifications wn
                JOIN calls c ON wn.call_sid = c.call_sid
                WHERE wn.status IN ('pending', 'retrying')
                    AND wn.retry_count < 3
                ORDER BY 
                    CASE wn.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'normal' THEN 3
                        WHEN 'low' THEN 4
                        ELSE 5
                    END,
                    CASE wn.notification_type
                        WHEN 'call_failed' THEN 1
                        WHEN 'call_completed' THEN 2
                        WHEN 'call_transcript' THEN 3
                        ELSE 4
                    END,
                    wn.created_at ASC
                LIMIT ?
            `;
            
            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Backward compatibility method
    async getPendingWebhookNotifications() {
        return this.getEnhancedPendingWebhookNotifications(50);
    }

    // FIXED: Enhanced notification metrics logging - Using INSERT OR REPLACE instead of ON CONFLICT
    async logNotificationMetric(notification_type, success, delivery_time_ms = null) {
        const today = new Date().toISOString().split('T')[0];
        
        return new Promise((resolve, reject) => {
            // First try to get existing record
            this.db.get(
                'SELECT * FROM notification_metrics WHERE date = ? AND notification_type = ?',
                [today, notification_type],
                (err, existingRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const success_increment = success ? 1 : 0;
                    const failure_increment = success ? 0 : 1;
                    const delivery_time = delivery_time_ms || 0;

                    if (existingRow) {
                        // Update existing record
                        const new_total = existingRow.total_count + 1;
                        const new_success = existingRow.success_count + success_increment;
                        const new_failure = existingRow.failure_count + failure_increment;
                        const new_avg_delivery = ((existingRow.avg_delivery_time_ms * existingRow.total_count) + delivery_time) / new_total;

                        const stmt = this.db.prepare(`
                            UPDATE notification_metrics 
                            SET total_count = ?, success_count = ?, failure_count = ?, 
                                avg_delivery_time_ms = ?, updated_at = datetime('now')
                            WHERE id = ?
                        `);
                        
                        stmt.run([new_total, new_success, new_failure, new_avg_delivery, existingRow.id], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.changes);
                            }
                        });
                        stmt.finalize();
                    } else {
                        // Insert new record
                        const stmt = this.db.prepare(`
                            INSERT INTO notification_metrics 
                            (date, notification_type, total_count, success_count, failure_count, avg_delivery_time_ms)
                            VALUES (?, ?, 1, ?, ?, ?)
                        `);
                        
                        stmt.run([today, notification_type, success_increment, failure_increment, delivery_time], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.lastID);
                            }
                        });
                        stmt.finalize();
                    }
                }
            );
        });
    }

    // Enhanced service health logging
    async logServiceHealth(service_name, status, details = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO service_health_logs (service_name, status, details)
                VALUES (?, ?, ?)
            `);
            
            stmt.run([service_name, status, JSON.stringify(details)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    // Call metrics tracking
    async addCallMetric(call_sid, metric_type, metric_value, metric_data = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO call_metrics (call_sid, metric_type, metric_value, metric_data)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run([call_sid, metric_type, metric_value, JSON.stringify(metric_data)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
            stmt.finalize();
        });
    }

    // FIXED: User session tracking - Using INSERT OR REPLACE instead of ON CONFLICT
    async updateUserSession(telegram_chat_id, call_outcome = null) {
        return new Promise((resolve, reject) => {
            // First try to get existing session
            this.db.get(
                'SELECT * FROM user_sessions WHERE telegram_chat_id = ?',
                [telegram_chat_id],
                (err, existingSession) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const success_increment = (call_outcome === 'completed') ? 1 : 0;
                    const failure_increment = (call_outcome && call_outcome !== 'completed') ? 1 : 0;

                    if (existingSession) {
                        // Update existing session
                        const stmt = this.db.prepare(`
                            UPDATE user_sessions 
                            SET total_calls = total_calls + 1,
                                successful_calls = successful_calls + ?,
                                failed_calls = failed_calls + ?,
                                last_activity = datetime('now')
                            WHERE telegram_chat_id = ?
                        `);
                        
                        stmt.run([success_increment, failure_increment, telegram_chat_id], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.changes);
                            }
                        });
                        stmt.finalize();
                    } else {
                        // Insert new session
                        const stmt = this.db.prepare(`
                            INSERT INTO user_sessions 
                            (telegram_chat_id, total_calls, successful_calls, failed_calls, last_activity)
                            VALUES (?, 1, ?, ?, datetime('now'))
                        `);
                        
                        stmt.run([telegram_chat_id, success_increment, failure_increment], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.lastID);
                            }
                        });
                        stmt.finalize();
                    }
                }
            );
        });
    }

    // Get enhanced call details
    async getCall(call_sid) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM calls WHERE call_sid = ?`;
            
            this.db.get(sql, [call_sid], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get enhanced call transcripts (supports both table names)
    async getCallTranscripts(call_sid) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM transcripts
                WHERE call_sid = ?
                ORDER BY interaction_count ASC, timestamp ASC
            `;

            this.db.all(sql, [call_sid], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const result = (rows || []).map((row) => {
                        const cleanMessage = row.clean_message || cleanTranscript(row.message || row.raw_message || '');
                        return {
                            ...row,
                            raw_message: row.raw_message || row.message || '',
                            clean_message: cleanMessage,
                            message: cleanMessage,
                        };
                    });
                    resolve(result);
                }
            });
        });
    }

    // Get enhanced calls with comprehensive metrics
    async getCallsWithTranscripts(limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, 
                       COUNT(ct.id) as transcript_count,
                       COUNT(CASE WHEN ct.personality_used IS NOT NULL THEN 1 END) as personality_adaptations,
                       GROUP_CONCAT(DISTINCT ct.personality_used) as personalities_used
                FROM calls c
                LEFT JOIN transcripts ct ON c.call_sid = ct.call_sid
                GROUP BY c.call_sid
                ORDER BY c.created_at DESC
                LIMIT ?
            `;
            
            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Get enhanced notification analytics
    async getNotificationAnalytics(days = 7) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    notification_type,
                    SUM(total_count) as total,
                    SUM(success_count) as successful,
                    SUM(failure_count) as failed,
                    AVG(avg_delivery_time_ms) as avg_delivery_time,
                    COUNT(*) as days_active,
                    MAX(updated_at) as last_updated
                FROM notification_metrics 
                WHERE date >= date('now', '-${days} days')
                GROUP BY notification_type
                ORDER BY total DESC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const analytics = {
                        period_days: days,
                        total_notifications: 0,
                        total_successful: 0,
                        total_failed: 0,
                        overall_success_rate: 0,
                        avg_delivery_time_ms: 0,
                        breakdown: rows || []
                    };
                    
                    let totalDeliveryTime = 0;
                    let deliveryTimeCount = 0;
                    
                    analytics.breakdown.forEach(row => {
                        analytics.total_notifications += row.total;
                        analytics.total_successful += row.successful;
                        analytics.total_failed += row.failed;
                        
                        if (row.avg_delivery_time && row.total > 0) {
                            totalDeliveryTime += row.avg_delivery_time * row.total;
                            deliveryTimeCount += row.total;
                        }
                    });
                    
                    if (analytics.total_notifications > 0) {
                        analytics.overall_success_rate = 
                            ((analytics.total_successful / analytics.total_notifications) * 100).toFixed(2);
                    }
                    
                    if (deliveryTimeCount > 0) {
                       analytics.avg_delivery_time_ms = (totalDeliveryTime / deliveryTimeCount).toFixed(2);
                   }
                   
                   resolve(analytics);
               }
           });
       });
   }

   // Get comprehensive call statistics
   async getEnhancedCallStats(hours = 24) {
       return new Promise((resolve, reject) => {
           const sql = `
               SELECT 
                   COUNT(*) as total_calls,
                   COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
                   COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
                   COUNT(CASE WHEN status = 'busy' THEN 1 END) as busy_calls,
                   COUNT(CASE WHEN status = 'no-answer' THEN 1 END) as no_answer_calls,
                   AVG(duration) as avg_duration,
                   AVG(answer_delay) as avg_answer_delay,
                   AVG(ring_duration) as avg_ring_duration,
                   COUNT(CASE WHEN created_at >= datetime('now', '-${hours} hours') THEN 1 END) as recent_calls,
                   COUNT(DISTINCT user_chat_id) as unique_users
               FROM calls
           `;
           
           this.db.get(sql, [], (err, row) => {
               if (err) {
                   reject(err);
               } else {
                   // Calculate success rate
                   const successRate = row.total_calls > 0 ? 
                       ((row.completed_calls / row.total_calls) * 100).toFixed(2) : 0;
                   
                   resolve({
                       ...row,
                       success_rate: successRate,
                       period_hours: hours
                   });
               }
           });
       });
   }

   // Get service health summary
   async getServiceHealthSummary(hours = 24) {
       return new Promise((resolve, reject) => {
           const sql = `
               SELECT 
                   service_name,
                   status,
                   COUNT(*) as count,
                   MAX(timestamp) as last_occurrence
               FROM service_health_logs 
               WHERE timestamp >= datetime('now', '-${hours} hours')
               GROUP BY service_name, status
               ORDER BY service_name, status
           `;
           
           this.db.all(sql, [], (err, rows) => {
               if (err) {
                   reject(err);
               } else {
                   const summary = {
                       period_hours: hours,
                       services: {},
                       total_events: 0
                   };
                   
                   rows.forEach(row => {
                       if (!summary.services[row.service_name]) {
                           summary.services[row.service_name] = {};
                       }
                       summary.services[row.service_name][row.status] = {
                           count: row.count,
                           last_occurrence: row.last_occurrence
                       };
                       summary.total_events += row.count;
                   });
                   
                   resolve(summary);
               }
           });
       });
   }

   // Create SMS messages table
   async initializeSMSTables() {
       const tables = [
           {
               sql: `CREATE TABLE IF NOT EXISTS sms_messages (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   message_sid TEXT UNIQUE NOT NULL,
                   to_number TEXT,
                   from_number TEXT,
                   body TEXT NOT NULL,
                   status TEXT DEFAULT 'queued',
                   direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
                   template_name TEXT,
                   template_variables TEXT,
                   error_code TEXT,
                   error_message TEXT,
                   ai_response TEXT,
                   response_message_sid TEXT,
                   user_chat_id TEXT,
                   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
               )`,
               context: 'create sms_messages table'
           },
           {
               sql: `CREATE TABLE IF NOT EXISTS bulk_sms_operations (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   total_recipients INTEGER NOT NULL,
                   successful INTEGER DEFAULT 0,
                   failed INTEGER DEFAULT 0,
                   message TEXT NOT NULL,
                   user_chat_id TEXT,
                   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
               )`,
               context: 'create bulk_sms_operations table'
           }
       ];

       for (const statement of tables) {
           await this.execute(statement.sql, `${statement.context}`);
       }

       const alterations = [
           {
               sql: 'ALTER TABLE sms_messages ADD COLUMN template_name TEXT',
               context: 'add template_name column to sms_messages',
               ignoreErrors: ['duplicate column name']
           },
           {
               sql: 'ALTER TABLE sms_messages ADD COLUMN template_variables TEXT',
               context: 'add template_variables column to sms_messages',
               ignoreErrors: ['duplicate column name']
           },
           {
               sql: 'ALTER TABLE sms_templates ADD COLUMN updated_by TEXT',
               context: 'add updated_by column to sms_templates',
               ignoreErrors: ['duplicate column name', 'no such table']
           }
       ];

       for (const alteration of alterations) {
           await this.execute(alteration.sql, alteration.context, { ignoreErrors: alteration.ignoreErrors });
       }

       console.log('✅ SMS tables verified successfully');
   }

   // Save SMS message
   async saveSMSMessage(messageData) {
       return new Promise((resolve, reject) => {
           const sql = `INSERT INTO sms_messages (
               message_sid, to_number, from_number, body, status,
               direction, template_name, template_variables,
               ai_response, response_message_sid, user_chat_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

           this.db.run(sql, [
               messageData.message_sid,
               messageData.to_number || null,
               messageData.from_number || null,
               messageData.body,
               messageData.status || 'queued',
               messageData.direction,
               messageData.template_name || null,
               messageData.template_variables ? JSON.stringify(messageData.template_variables) : null,
               messageData.ai_response || null,
               messageData.response_message_sid || null,
               messageData.user_chat_id || null
           ], function (err) {
               if (err) {
                   console.error('Error saving SMS message:', err);
                   reject(err);
               } else {
                   resolve(this.lastID);
               }
           });
       });
   }

   // Update SMS status
   async updateSMSStatus(messageSid, statusData) {
       return new Promise((resolve, reject) => {
           const sql = `UPDATE sms_messages 
               SET status = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE message_sid = ?`;

           this.db.run(sql, [
               statusData.status,
               statusData.error_code || null,
               statusData.error_message || null,
               messageSid
           ], function (err) {
               if (err) {
                   console.error('Error updating SMS status:', err);
                   reject(err);
               } else {
                   resolve(this.changes);
               }
           });
       });
   }

   // Log bulk SMS operation
   async logBulkSMSOperation(operationData) {
       return new Promise((resolve, reject) => {
           const sql = `INSERT INTO bulk_sms_operations (
               total_recipients, successful, failed, message, user_chat_id
           ) VALUES (?, ?, ?, ?, ?)`;

           this.db.run(sql, [
               operationData.total_recipients,
               operationData.successful,
               operationData.failed,
               operationData.message,
               operationData.user_chat_id || null
           ], function (err) {
               if (err) {
                   console.error('Error logging bulk SMS operation:', err);
                   reject(err);
               } else {
                   resolve(this.lastID);
               }
           });
       });
   }

    async getAllTemplates(options = {}) {
        const { includeContent = false } = options;
        const columns = includeContent ? '*' : 'id, name, description, is_builtin, metadata, created_by, created_at, updated_at';

        return new Promise((resolve, reject) => {
            this.db.all(`SELECT ${columns} FROM sms_templates ORDER BY name`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const templates = (rows || []).map((row) => ({
                        ...row,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {}
                    }));
                    resolve(templates);
                }
            });
        });
    }

    async getTemplateByName(name) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM sms_templates WHERE name = ?`, [name], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    row.metadata = row.metadata ? JSON.parse(row.metadata) : {};
                    resolve(row);
                }
            });
        });
    }

    async createTemplate(templateData) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO sms_templates (name, description, content, metadata, is_builtin, created_by, updated_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;

            this.db.run(sql, [
                templateData.name,
                templateData.description || null,
                templateData.content,
                templateData.metadata ? JSON.stringify(templateData.metadata) : null,
                templateData.is_builtin ? 1 : 0,
                templateData.created_by || null,
                templateData.updated_by || templateData.created_by || null
            ], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateTemplate(name, updates) {
        const fields = [];
        const values = [];

        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description || null);
        }

        if (updates.content !== undefined) {
            fields.push('content = ?');
            values.push(updates.content);
        }

        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
        }

        if (updates.is_builtin !== undefined) {
            fields.push('is_builtin = ?');
            values.push(updates.is_builtin ? 1 : 0);
        }

        if (updates.updated_by !== undefined) {
            fields.push('updated_by = ?');
            values.push(updates.updated_by || null);
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');

        values.push(name);

        const sql = `UPDATE sms_templates SET ${fields.join(', ')} WHERE name = ?`;

        return new Promise((resolve, reject) => {
            this.db.run(sql, values, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async deleteTemplate(name) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM sms_templates WHERE name = ? AND is_builtin = 0`, [name], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

   // Get SMS messages
   async getSMSMessages(limit = 50, offset = 0) {
       return new Promise((resolve, reject) => {
           const sql = `SELECT * FROM sms_messages 
               ORDER BY created_at DESC 
               LIMIT ? OFFSET ?`;

           this.db.all(sql, [limit, offset], (err, rows) => {
               if (err) {
                   console.error('Error getting SMS messages:', err);
                   reject(err);
               } else {
                   resolve(rows || []);
               }
           });
       });
   }

   // Get SMS conversation
   async getSMSConversation(phoneNumber, limit = 50) {
       return new Promise((resolve, reject) => {
           const sql = `SELECT * FROM sms_messages 
               WHERE to_number = ? OR from_number = ? 
               ORDER BY created_at ASC 
               LIMIT ?`;

           this.db.all(sql, [phoneNumber, phoneNumber, limit], (err, rows) => {
               if (err) {
                   console.error('Error getting SMS conversation:', err);
                   reject(err);
               } else {
                   resolve(rows || []);
               }
           });
       });
   }

   // Comprehensive cleanup with enhanced metrics
   async cleanupOldRecords(daysToKeep = 30) {
       const tables = [
           { name: 'call_states', dateField: 'timestamp' },
           { name: 'service_health_logs', dateField: 'timestamp' },
           { name: 'call_metrics', dateField: 'timestamp' },
           { name: 'notification_metrics', dateField: 'created_at' }
       ];
       
       let totalCleaned = 0;
       const cleanupResults = {};
       
       for (const table of tables) {
           const cleaned = await new Promise((resolve, reject) => {
               const sql = `DELETE FROM ${table.name} 
                   WHERE ${table.dateField} < datetime('now', '-${daysToKeep} days')`;
               
               this.db.run(sql, function(err) {
                   if (err) {
                       reject(err);
                   } else {
                       resolve(this.changes);
                   }
               });
           });
           
           cleanupResults[table.name] = cleaned;
           totalCleaned += cleaned;
           
           if (cleaned > 0) {
               console.log(`🧹 Cleaned ${cleaned} old records from ${table.name}`);
           }
       }
       
       // Clean up old successful webhook notifications (keep for 7 days)
       const webhooksCleaned = await new Promise((resolve, reject) => {
           const sql = `DELETE FROM webhook_notifications 
               WHERE status = 'sent' 
               AND created_at < datetime('now', '-7 days')`;
           
           this.db.run(sql, function(err) {
               if (err) {
                   reject(err);
               } else {
                   resolve(this.changes);
               }
           });
       });
       
       cleanupResults.webhook_notifications = webhooksCleaned;
       totalCleaned += webhooksCleaned;
       
       if (webhooksCleaned > 0) {
           console.log(`🧹 Cleaned ${webhooksCleaned} old successful webhook notifications`);
       }
       
       // Clean up old user sessions (keep for 90 days)
       const sessionsCleaned = await new Promise((resolve, reject) => {
           const sql = `DELETE FROM user_sessions 
               WHERE last_activity < datetime('now', '-90 days')`;
           
           this.db.run(sql, function(err) {
               if (err) {
                   reject(err);
               } else {
                   resolve(this.changes);
               }
           });
       });
       
       cleanupResults.user_sessions = sessionsCleaned;
       totalCleaned += sessionsCleaned;
       
       if (sessionsCleaned > 0) {
           console.log(`🧹 Cleaned ${sessionsCleaned} old user sessions`);
       }
       
       // Log cleanup operation
       await this.logServiceHealth('database', 'cleanup_completed', {
           total_cleaned: totalCleaned,
           days_kept: daysToKeep,
           breakdown: cleanupResults
       });
       
       console.log(`✅ Enhanced cleanup completed: ${totalCleaned} total records cleaned`);
       
       return {
           total_cleaned: totalCleaned,
           breakdown: cleanupResults,
           days_kept: daysToKeep
       };
   }

   // Database maintenance and optimization
   async optimizeDatabase() {
       return new Promise((resolve, reject) => {
           console.log('🔧 Running database optimization...');
           
           // Run VACUUM to reclaim space and defragment
           this.db.run('VACUUM', (err) => {
               if (err) {
                   console.error('❌ Database VACUUM failed:', err);
                   reject(err);
               } else {
                   // Run ANALYZE to update query planner statistics
                   this.db.run('ANALYZE', (analyzeErr) => {
                       if (analyzeErr) {
                           console.error('❌ Database ANALYZE failed:', analyzeErr);
                           reject(analyzeErr);
                       } else {
                           console.log('✅ Database optimization completed');
                           resolve(true);
                       }
                   });
               }
           });
       });
   }

   // Get database size and performance metrics
   async getDatabaseMetrics() {
       return new Promise((resolve, reject) => {
           const fs = require('fs');
           
           // Get file size
           let fileSize = 0;
           try {
               const stats = fs.statSync(this.dbPath);
               fileSize = stats.size;
           } catch (e) {
               console.warn('Could not get database file size:', e.message);
           }
           
           // Get table counts
           const sql = `
               SELECT 
                   'calls' as table_name,
                   COUNT(*) as row_count
               FROM calls
               UNION ALL
               SELECT 'call_transcripts', COUNT(*) FROM call_transcripts
               UNION ALL
               SELECT 'transcripts', COUNT(*) FROM transcripts
               UNION ALL
               SELECT 'call_states', COUNT(*) FROM call_states
               UNION ALL
               SELECT 'webhook_notifications', COUNT(*) FROM webhook_notifications
               UNION ALL
               SELECT 'dtmf_entries', COUNT(*) FROM dtmf_entries
               UNION ALL
               SELECT 'notification_metrics', COUNT(*) FROM notification_metrics
               UNION ALL
               SELECT 'service_health_logs', COUNT(*) FROM service_health_logs
               UNION ALL
               SELECT 'call_metrics', COUNT(*) FROM call_metrics
               UNION ALL
               SELECT 'user_sessions', COUNT(*) FROM user_sessions
               UNION ALL
               SELECT 'sms_messages', COUNT(*) FROM sms_messages
               UNION ALL
               SELECT 'bulk_sms_operations', COUNT(*) FROM bulk_sms_operations
           `;
           
           this.db.all(sql, [], (err, rows) => {
               if (err) {
                   reject(err);
               } else {
                   const metrics = {
                       file_size_bytes: fileSize,
                       file_size_mb: (fileSize / (1024 * 1024)).toFixed(2),
                       table_counts: {},
                       total_rows: 0
                   };
                   
                   rows.forEach(row => {
                       metrics.table_counts[row.table_name] = row.row_count;
                       metrics.total_rows += row.row_count;
                   });
                   
                   resolve(metrics);
               }
           });
       });
   }

   // Enhanced close method with cleanup
   async close() {
       if (this.db) {
           return new Promise((resolve) => {
               // Log database shutdown
               this.logServiceHealth('database', 'shutdown_initiated', {
                   timestamp: new Date().toISOString()
               }).then(() => {
                   this.db.close((err) => {
                       if (err) {
                           console.error('Error closing enhanced database:', err);
                       } else {
                           console.log('✅ Enhanced database connection closed');
                       }
                       this.db = null;
                       resolve();
                   });
               }).catch(() => {
                   // If logging fails, still close the database
                   this.db.close((err) => {
                       if (err) {
                           console.error('Error closing enhanced database:', err);
                       } else {
                           console.log('✅ Enhanced database connection closed');
                       }
                       this.db = null;
                       resolve();
                   });
               });
           });
       }
   }

   // Health check method
   async healthCheck() {
       return new Promise((resolve, reject) => {
           if (!this.isInitialized) {
               reject(new Error('Database not initialized'));
               return;
           }
           
           // Simple query to test database connectivity
           this.db.get('SELECT 1 as test', [], (err, row) => {
               if (err) {
                   reject(err);
               } else {
                   resolve({
                       status: 'healthy',
                       initialized: this.isInitialized,
                       timestamp: new Date().toISOString()
                   });
               }
           });
       });
   }
}

module.exports = EnhancedDatabase;
