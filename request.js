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
class RequestBuilder{
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
        if(!this._query) this._query = new URLSearchParams();;
        if (typeof param === "object") {
            for (const [k, v] of Object.entries(param)) {
                this._query.set(k, v);
            }
        } else if(typeof param === "string"){
            this._query.set(param, val);
        }
        return this;
    }

    header(key, value) {
        this._headers[key] = value;
        return this;
    }
    headers(obj) {
        Object.assign(this._headers, obj);
        return this;
    }

    contentType(type) {return this.header("Content-Type", type);}
    accept(type) {return this.header("Accept", type);}
    auth(token) {return this.header("Authorization", `Bearer ${token}`);}

    body(data) {
        if (this._method in ['GET', 'HEAD', 'OPTIONS']) {
            throw new Error(`${this._method} request method cannot have a body`);
        }
        this._body = data;
        return this;
    }
    jsonBody(obj){
        this.body(JSON.stringify(obj));
        this.contentType("application/json");
        return this;
    }
    fileBody(file){
        this.body(file);
        this.contentType(file.type);
        return this;
    }
    abortController(controller){
        this._signal = controller.signal;
        return this;
    }
    timeout(ms = 5000){
        const controller = new AbortController();
        this.abortController(controller);
        setTimeout(controller.abort, ms);
        return this;
    }
    retry(times = 1, delay = 3000){
        this._retry = {times: times, delay: delay};
        return this;
    }
    async readRaw() {
        if(this._isRead) throw new Error("Cannot send a request twice!");
        this._isRead = true;

        const retries = this._retry?.times ?? 0;
        const delay = this._retry?.delay ?? 0;

        let attempt = 0;

        const url = new URL(this._url, window.location.origin);
        url.search = this._query?.toString() || undefined;

        while (true) {
            try {
                const res = await fetch(url.toString(), {
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
    async read(callback = undefined) { // callback: (res) => {...};
        const res = await this.readRaw();
        
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
    async readBlob(){
        return await (await this.readRaw()).blob();
    }
    async readText(){
        return await (await this.readRaw()).text();
    }
    async readArrayBuffer(){
        return await (await this.readRaw()).arrayBuffer();
    }
    async readJson(){
        return await (await this.readRaw()).json();
    }
};

export const Request = {
    defaultHeaders: {},
    setDefaultHeaders(defaultHeaders) {
        this.defaultHeaders = defaultHeaders;
    },

    request(method, url = '') {
        return new RequestBuilder(method.toUpperCase(), url, this.defaultHeaders);
    },

    get(url = '') {
        return this.request("GET", url);
    },
    post(url = '') {
        return this.request("POST", url);
    },
    put(url = '') {
        return this.request("PUT", url);
    },
    patch(url = '') {
        return this.request("PATCH", url);
    },
    delete(url = '') {
        return this.request("DELETE", url);
    },
    head(url = '') {
        return this.request("HEAD", url);
    },
    options(url = '') {
        return this.request("OPTIONS", url);
    }
};
