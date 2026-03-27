class RequestBuilder{
    constructor(method, url, headers){
        this._url = url;
        this._method = method;
        this._headers = headers;
        this._body = null;
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
    async readRaw() {
        const res = await fetch(this._url, {
            method: this._method,
            headers: this._headers,
            body: this._body
        });
        return res;
    }
    async read(callback = undefined) { // callback: (res) => {...};
        const res = await this.readRaw();
        
        if(callback){
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