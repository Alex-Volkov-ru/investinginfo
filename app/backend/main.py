import os
import uvicorn
from app.backend.app import create_app

app = create_app()

if __name__ == "__main__":
    reload_flag = os.getenv("DEBUG", "true").lower() == "true"
    uvicorn.run("app.backend.main:app", host="0.0.0.0", port=8000, reload=reload_flag)
