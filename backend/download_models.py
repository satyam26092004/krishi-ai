import os
import sys
import urllib.request
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("model_downloader")

# URLs to download the models from (Replace with your actual GitHub Release URL or cloud storage URL)
# Note: GitHub Releases support files up to 2GB, making them perfect for this.
M1_URL = os.environ.get("M1_MODEL_URL", "https://github.com/satyam26092004/krishi-ai/releases/download/v1.0.0/pipeline_m1.pkl")
M2_URL = os.environ.get("M2_MODEL_URL", "https://github.com/satyam26092004/krishi-ai/releases/download/v1.0.0/pipeline_m2.pkl")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models_ml")

def download_file(url, dest_path):
    logger.info(f"Downloading {url} to {dest_path}...")
    try:
        # Custom reporter for download progress
        def progress_reporter(block_num, block_size, total_size):
            read_so_far = block_num * block_size
            if total_size > 0:
                percent = read_so_far * 1e2 / total_size
                s = f"\rProgress: {percent:.1f}% ({read_so_far / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)"
                sys.stdout.write(s)
                sys.stdout.flush()
            else:
                sys.stdout.write(f"\rDownloaded {read_so_far / (1024*1024):.1f} MB")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, dest_path, reporthook=progress_reporter)
        sys.stdout.write("\n")
        logger.info(f"Successfully downloaded {os.path.basename(dest_path)}.")
    except Exception as e:
        logger.error(f"\nFailed to download {url}: {e}")
        # Remove partial file if download failed
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise e

def main():
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        logger.info(f"Created directory: {MODEL_DIR}")

    m1_path = os.path.join(MODEL_DIR, "pipeline_m1.pkl")
    m2_path = os.path.join(MODEL_DIR, "pipeline_m2.pkl")

    # Check and download model 1 (1.24 GB)
    if not os.path.exists(m1_path) or os.path.getsize(m1_path) < 1000000:
        logger.info("Crop Prediction model (pipeline_m1.pkl) is missing or incomplete.")
        try:
            download_file(M1_URL, m1_path)
        except Exception:
            logger.warning("Could not download Crop Prediction model. Server will run in fallback/mock mode.")
    else:
        logger.info("Crop Prediction model (pipeline_m1.pkl) already exists.")

    # Check and download model 2 (33.7 MB)
    if not os.path.exists(m2_path) or os.path.getsize(m2_path) < 1000000:
        logger.info("Yield Prediction model (pipeline_m2.pkl) is missing or incomplete.")
        try:
            download_file(M2_URL, m2_path)
        except Exception:
            logger.warning("Could not download Yield Prediction model. Server will run in fallback/mock mode.")
    else:
        logger.info("Yield Prediction model (pipeline_m2.pkl) already exists.")

if __name__ == "__main__":
    main()
