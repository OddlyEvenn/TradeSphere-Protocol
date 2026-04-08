/**
 * Simple Logger Utility for TradeSphere Backend
 * Provides standardized, colorized logs for blockchain transactions and system events.
 */

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
        crimson: "\x1b[38m"
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m",
        crimson: "\x1b[48m"
    }
};

class TransactionLogger {
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(level: string, message: string, color: string): string {
        return `${colors.dim}[${this.getTimestamp()}]${colors.reset} ${color}${colors.bright}[${level}]${colors.reset} ${message}`;
    }

    public info(message: string): void {
        console.log(this.formatMessage("INFO", message, colors.fg.blue));
    }

    public success(message: string): void {
        console.log(this.formatMessage("SUCCESS", message, colors.fg.green));
    }

    public warn(message: string): void {
        console.warn(this.formatMessage("WARN", message, colors.fg.yellow));
    }

    public os(message: string): void {
        console.log(this.formatMessage("OS-KERNEL", message, colors.fg.cyan));
    }

    public error(message: string, error?: any): void {
        console.error(this.formatMessage("ERROR", message, colors.fg.red));
        if (error) {
            console.error(colors.fg.red + (error.stack || error) + colors.reset);
        }
    }

    /**
     * Specialized logging for blockchain transactions
     */
    public transaction(details: {
        event: string;
        txHash?: string;
        blockchainId?: number | string;
        dbId?: string;
        actor?: string;
        status?: string;
    }): void {
        const { event, txHash, blockchainId, dbId, actor, status } = details;

        let msg = `${colors.fg.magenta}${colors.bright}TRANS:${colors.reset} ${colors.bright}${event}${colors.reset}`;

        if (actor) msg += ` | Actor: ${actor}`;
        if (blockchainId) msg += ` | BC-ID: ${blockchainId}`;
        if (dbId) msg += ` | DB-ID: ${dbId.substring(0, 8)}...`;
        if (status) msg += ` | Status: ${colors.fg.cyan}${status}${colors.reset}`;

        console.log(this.formatMessage("ACTION", msg, colors.fg.magenta));

        if (txHash) {
            console.log(`          ${colors.dim}Hash:${colors.reset} ${colors.fg.yellow}${txHash}${colors.reset}`);
        }
    }
}

export const logger = new TransactionLogger();
