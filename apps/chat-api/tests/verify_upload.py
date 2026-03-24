import httpx
import base64
import time

def test_upload_image(url="http://localhost:8001/chat/images/upload"):
    print(f"Testing upload to {url}...")
    
    # 1. Test small image
    small_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    try:
        response = httpx.post(url, json={"image": small_image})
        print(f"Small image upload: {response.status_code}")
        if response.status_code == 200:
            print(f"Success! Image ID: {response.json().get('image_id')}")
        else:
            print(f"Failed! {response.text}")
    except Exception as e:
        print(f"Error connecting to server: {e}")
        return

    # 2. Test large image (above 10MB limit)
    # 10MB is approx 10 * 1024 * 1024 bytes. 
    # Let's create a ~15MB base64 string
    large_base64 = "data:image/png;base64," + "A" * (15 * 1024 * 1024)
    print("Testing large image (>10MB)...")
    response = httpx.post(url, json={"image": large_base64}, timeout=30.0)
    print(f"Large image upload status: {response.status_code}")
    if response.status_code == 413:
        print("Success! Got 413 Payload Too Large as expected.")
    else:
        print(f"Unexpected status: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_upload_image()
