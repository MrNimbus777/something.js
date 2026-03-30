// usage: import {Request} from 'https://cdn.jsdelivr.net/gh/MrNimbus777/something.js@main/request.js';
//
export function setLimitedInterval(callback = () => {}, delay = 1000, times = 1){
    const interval = setInterval(() => {
        if(times-- <= 0) {
            clearInterval(interval);
            return;
        }
        callback();
    }, delay);
    return interval;
}
class _RequestPipelineEntity_ {
    constructor(method, url, headers){
        this._url = url;
        this._method = method;
        this._headers = headers;
        this._body = undefined;
        this._isRead = false;
        this._signal = undefined;
        this._retry = undefined;
        this._query = undefined;
    }
    
    query(param, val = undefined){
        if(!this._query) this._query = new URLSearchParams();
        if (typeof param === "object") {
            for (const [k, v] of Object.entries(param)) {
                this._query.set(k, v);
            }
        } else if(typeof param === "string"){
            this._query.set(param, val);
        }
        return this;
    }

    header(param, val = undefined) {
        if (typeof param === "object") {
            for (const [k, v] of Object.entries(param)) {
                this._headers[k] = v;
            }
        } else if(typeof param === "string"){
            this._headers[param] = val;
        }
        return this;
    }

    contentType(type) {return this.header("Content-Type", type);}
    accept(type) {return this.header("Accept", type);}
    auth(token) {return this.header("Authorization", `Bearer ${token}`);}

    body(data) {
        if (['GET', 'HEAD', 'OPTIONS'].includes(this._method)){
            throw new Error(`${this._method} request method cannot have a body`);
        }
        this._body = data;
        return this;
    }
    bodyJson(obj){
        this.body(JSON.stringify(obj));
        this.contentType("application/json");
        return this;
    }
    bodyFile(file){
        this.body(file);
        this.contentType(file.type);
        return this;
    }
    withAbort(controller){
        this._signal = controller.signal;
        return this;
    }
    timeout(ms = 5000){
        const controller = new AbortController();
        this.withAbort(controller);
        setTimeout(() => controller.abort(), ms);
        return this;
    }
    retry(times = 1, delay = 3000){
        this._retry = {times: times, delay: delay};
        return this;
    }
    async send() {
        if(this._isRead) throw new Error("Cannot send a request twice!");
        this._isRead = true;

        const retries = this._retry?.times ?? 0;
        const delay = this._retry?.delay ?? 0;

        let attempt = 0;

        this._url.search = this._query?.toString() || undefined;

        while (true) {
            try {
                const res = await fetch(this._url, {
                    method: this._method,
                    headers: this._headers,
                    body: this._body,
                    signal: this._signal
                });
                if (res.status >= 500 && attempt < retries) {
                    attempt++;
                    await (new Promise(resolve => setTimeout(resolve, delay)));
                    continue;
                }
                
                return res;
            } catch (err) {
                // Retry on network errors
                if (attempt < retries && err.name !== "AbortError") {
                    attempt++;
                    await (new Promise(resolve => setTimeout(resolve, delay)));
                    continue;
                }

                throw err;
            }
        }
    }
    async sendAndParse(callback = undefined) { // callback: (res) => {...};
        const res = await this.send();
        
        if(callback && typeof callback === 'function'){
            return callback(res);
        }
        
        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) 
            return await res.json();
        
        if (contentType.includes("text/")) 
            return await res.text();
        
        if (contentType.includes("application/octet-stream")) 
            return await res.arrayBuffer();

        // fallback
        return await res.text();
    }
    async sendAndParseBlob(){
        return await (await this.send()).blob();
    }
    async sendAndParseText(){
        return await (await this.send()).text();
    }
    async sendAndParseArrayBuffer(){
        return await (await this.send()).arrayBuffer();
    }
    async sendAndParseJson(){
        return await (await this.send()).json();
    }
};

export class WebSocketBuilder {
    constructor(url){
        this._url = url;
        this._protocols = undefined;

        this._onOpen = undefined;
        this._onMessage = (event) => {throw new Error("WebSocket recieved a message that is not processed further: " + event.data);};
        this._onMessageJson = undefined;
        this._onError = undefined;
        this._onClose = undefined;
    }

    onOpen(callback = () => console.log("Connected!")) {
        this._onOpen = callback;
        return this;
    }
    onMessage(callback = (event) => {throw new Error("WebSocket recieved a message that is not processed further: " + event.data);}) {
        this._onMessage = callback;
        return this;
    }
    onMessageJson(callback = (json) => {console.log("WebSocket recieved a json: " + json)}){
        this._onMessageJson = callback;
        if(this._onMessageJson && !this._onMessage) return this.onMessage();
        return this;
    }
    onError(callback = (err) => console.error("Error:", err)) {
        this._onError = callback;
        return this;
    }
    onClose(callback = (event) => console.log("Disconnected:", event.code, event.reason)) {
        this._onClose = callback;
        return this;
    }
    
    protocols(list){
        this._protocols = list;
        return this;
    }

    build(){
        const ws = new WebSocket(this._url, this._protocols);
        
        ws.onopen = this._onOpen;
        ws.onmessage = this._onMessageJson 
        ? 
        (event) => {
            try{
                const json = JSON.parse(event.data);
                return this._onMessageJson(json);
            } catch {
                return this._onMessage(event);
            }
        }
        : this._onMessage;
        ws.onerror = this._onError;
        ws.onclose = this._onClose;

        return ws;
    }
};

export const Request = {
    defaultHeaders: {},
    setDefaultHeaders(defaultHeaders) {
        this.defaultHeaders = defaultHeaders;
    },

    request(method, url = new URL('', window.location.origin)) {
        return new _RequestPipelineEntity_(method.toUpperCase(), url, {...this.defaultHeaders});
    },

    get(url = '', absolutePath = false) {
        return this.request("GET", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    post(url = '', absolutePath = false) {
        return this.request("POST", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    put(url = '', absolutePath = false) {
        return this.request("PUT", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    patch(url = '', absolutePath = false) {
        return this.request("PATCH", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    delete(url = '', absolutePath = false) {
        return this.request("DELETE", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    head(url = '', absolutePath = false) {
        return this.request("HEAD", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    options(url = '', absolutePath = false) {
        return this.request("OPTIONS", absolutePath ? new URL(url) : new URL(url, window.location.origin));
    },
    makeWebSocketsAlwaysSecure: false,
    websocket(url = '', absolutePath = false){
        if(makeWebSocketsAlwaysSecure === true) return this.websocketSecure(url, absolutePath); 
        return new WebSocketBuilder(absolutePath ? new URL(url) : new URL(`ws://${window.location.hostname}/${url}`));
    },
    websocketSecure(url = '', absolutePath = false){
        return new WebSocketBuilder(absolutePath ? new URL(url) : new URL(`wss://${window.location.hostname}/${url}`));
    }
};
