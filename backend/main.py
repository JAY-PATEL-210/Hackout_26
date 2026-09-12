from fastapi import FastAPI

app = FastAPI(
    title="Predictive Maintenance Platform API",
    description="Backend API for Predictive Maintenance Platform",
    version="0.1.0",
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Hello World - Predictive Maintenance Platform Backend",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
