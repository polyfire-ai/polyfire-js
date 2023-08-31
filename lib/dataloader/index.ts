import pdf from "pdf-parse";

import { Memory } from "../memory";
import { transcribe } from "../transcribe";
import { splitString } from "../split";

import { InputClientOptions } from "../clientOpts";

interface MinimalStream {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
}

type LoaderFileInput = string | MinimalStream | Buffer;

function stream2buffer(stream: MinimalStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buf: any[] = [];

        stream.on("data", (chunk) => buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(buf)));
        stream.on("error", (err) => reject(err));
    });
}

async function loaderInputToBuffer(input: LoaderFileInput): Promise<Buffer> {
    if (input instanceof Buffer) {
        return input;
    }
    if (typeof input === "string") {
        const fs = await import("fs");
        return new Promise<Buffer>((res, rej) =>
            fs.readFile(input, (err, data) => (err !== null ? rej(err) : res(data))),
        );
    }

    return stream2buffer(input);
}

async function pdfParsePages(fileBuffer: Buffer): Promise<string[]> {
    return new Promise((res, rej) => {
        const result: string[] = [];
        pdf(fileBuffer, {
            pagerender: (e) => {
                return e
                    .getTextContent({ normalizeWhitespace: true })
                    .then(
                        (e: { items: { str: string }[] }) =>
                            e.items
                                .map((s) => s.str)
                                .join("")
                                .replace(/\x00/g, ""), // eslint-disable-line
                    )
                    .then((r: string) => result.push(r));
            },
        }).then(() => res(result));
    });
}

async function batchify<T extends Array<unknown>>(
    array: T,
    size: number,
    callback: (input: T) => Promise<void>,
): Promise<void> {
    if (array.length < size) {
        return callback(array);
    }
    await callback(array.slice(0, size) as T);
    await batchify(array.slice(size) as T, size, callback);
}

export type LoaderFunction = (memory: Memory, clientOptions: InputClientOptions) => Promise<void>;

export function PDFLoader(file: LoaderFileInput): LoaderFunction {
    return async function loadPdfIntoMemory(
        memory: Memory,
        _clientOptions: InputClientOptions = {},
    ) {
        const fileBuffer = await loaderInputToBuffer(file);
        const allPages = await pdfParsePages(fileBuffer);

        async function addPagesIntoMemory(pages: string[]) {
            await Promise.all(pages.map((page) => memory.add(page)));
        }

        await batchify(allPages, 10, addPagesIntoMemory);
    };
}

export function TextFileLoader(file: LoaderFileInput, maxTokenPerChunk = 100): LoaderFunction {
    return async function loadPdfIntoMemory(
        memory: Memory,
        _clientOptions: InputClientOptions = {},
    ) {
        const fileBuffer = await loaderInputToBuffer(file);
        const splittedFile = splitString(fileBuffer.toString("utf8"), maxTokenPerChunk);

        async function addBatchIntoMemory(batches: string[]) {
            await Promise.all(batches.map(async (batch) => memory.add(batch)));
        }

        await batchify(splittedFile, 10, addBatchIntoMemory);
    };
}

export function StringLoader(str: string, maxTokenPerChunk = 100): LoaderFunction {
    return async function loadPdfIntoMemory(
        memory: Memory,
        _clientOptions: InputClientOptions = {},
    ) {
        const splittedStr = splitString(str, maxTokenPerChunk);

        async function addBatchIntoMemory(batches: string[]) {
            await Promise.all(batches.map(async (batch) => memory.add(batch)));
        }

        await batchify(splittedStr, 10, addBatchIntoMemory);
    };
}

export function AudioLoader(file: LoaderFileInput, maxTokenPerChunk = 100): LoaderFunction {
    return async function loadAudioIntoMemory(
        memory: Memory,
        clientOptions: InputClientOptions = {},
    ) {
        const fileBuffer = await loaderInputToBuffer(file);
        const transcription = await transcribe(fileBuffer, clientOptions);
        const transcriptions = splitString(transcription, maxTokenPerChunk);

        async function addBatchIntoMemory(batches: string[]) {
            await Promise.all(batches.map(async (batch) => memory.add(batch)));
        }

        await batchify(transcriptions, 10, addBatchIntoMemory);
    };
}

export async function loaderToMemory(
    loaders: LoaderFunction | LoaderFunction[],
    clientOptions: InputClientOptions = {},
): Promise<Memory> {
    const memory = new Memory(clientOptions);

    if (typeof loaders === "function") {
        await loaders(memory, clientOptions);
    } else {
        await Promise.all(loaders.map((loader) => loader(memory, clientOptions)));
    }

    return memory;
}
