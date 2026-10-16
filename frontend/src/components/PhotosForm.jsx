import { useRef, useState, useCallback, useEffect } from "react";
import StampCardShell from "./StampCardShell";

/**
 * PhotosForm
 * Step 2 of the signup flow: drag-and-drop (or click-to-browse) photo upload.
 * The drop zone stretches to fill whatever room is left inside the fixed-size
 * stamp card. Sizes are `calc(<Figma px> * var(--u))`, see pages/Signup.jsx.
 *
 * Usage:
 *   <PhotosForm onContinue={(files) => console.log(files)} />
 *   <PhotosForm step={2} totalSteps={3} minPhotos={1} onContinue={handleNext} />
 */
export default function PhotosForm({ step = 2, totalSteps = 3, minPhotos = 1, onContinue, initialFiles = [], onBack }) {
  const inputRef = useRef(null);
  const previewUrls = useRef(new Set());
  const [photos, setPhotos] = useState([]); // { id, file, url }
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    const restored = initialFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      return { id: `restored-${index}`, file, url };
    });
    setPhotos(restored);
    return () => { restored.forEach(photo => { URL.revokeObjectURL(photo.url); previewUrls.current.delete(photo.url); }); };
  }, []);

  const isValid = photos.length >= minPhotos;

  // Release object URLs when the component unmounts.
  useEffect(() => {
    return () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList);
    const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (files.some(file => !supported.includes(file.type))) {
      setFileError("Choose a JPG, PNG, WEBP or static GIF photo. HEIC files need to be converted first."); return;
    }
    if (files.some(file => file.size > 50 * 1024 * 1024)) {
      setFileError("Each photo must be 50 MB or smaller."); return;
    }
    if ([...photos.map(photo => photo.file), ...files].reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) { setFileError("Choose up to 50 MB of photos in total."); return; }
    if (!files.length) return;
    if (photos.length + files.length > 10) { setFileError("You can add up to 10 photos."); return; }
    setFileError("");
    const imageFiles = files;
    const next = imageFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: (() => {
        const url = URL.createObjectURL(file);
        previewUrls.current.add(url);
        return url;
      })(),
    }));
    setPhotos((prev) => [...prev, ...next]);
  }, [photos]);

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        previewUrls.current.delete(target.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const openBrowser = () => inputRef.current?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleContinue = () => {
    setTouched(true);
    if (!isValid) return;
    onContinue?.(photos.map((p) => p.file));
  };

  return (
    <StampCardShell
      title="Photos"
      step={step}
      totalSteps={totalSteps}
      buttonLabel="Continue"
      onButtonClick={handleContinue}
      onBack={onBack}
      error={
        fileError || (touched && !isValid
          ? `Add at least ${minPhotos} photo${minPhotos > 1 ? "s" : ""} to continue.`
          : null)
      }
    >
      <style>{`
        .photos-field-group {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: calc(5 * var(--u));
        }
        .photos-field-label {
          font-weight: 700;
          font-size: calc(24 * var(--u));
          line-height: calc(36 * var(--u));
          text-transform: uppercase;
          color: var(--pd-ink);
        }

        .photos-dropzone {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: auto;
          background: var(--pd-tan);
          border: calc(2 * var(--u)) dashed transparent;
          border-radius: calc(5 * var(--u));
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: calc(16 * var(--u));
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .photos-dropzone-active {
          border-color: var(--pd-maroon);
          background: #E7D6C8;
        }
        .photos-dropzone:focus-visible {
          outline: 2px solid var(--pd-maroon);
          outline-offset: 3px;
        }

        .photos-hidden-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .photos-choose-label {
          font-weight: 700;
          font-size: calc(20 * var(--u));
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--pd-ink);
          opacity: 0.65;
        }

        .photos-grid {
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: calc(10 * var(--u));
          width: 100%;
        }
        .photos-thumb {
          position: relative;
          width: calc(100 * var(--u));
          height: calc(100 * var(--u));
          border-radius: calc(5 * var(--u));
          overflow: hidden;
          background: #fff;
        }
        .photos-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photos-thumb-remove {
          position: absolute;
          top: calc(4 * var(--u));
          right: calc(4 * var(--u));
          width: calc(22 * var(--u));
          height: calc(22 * var(--u));
          border-radius: 50%;
          border: none;
          background: var(--pd-maroon);
          color: #fff;
          font-size: calc(16 * var(--u));
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .photos-add-more {
          width: calc(100 * var(--u));
          height: calc(100 * var(--u));
          border-radius: calc(5 * var(--u));
          border: calc(2 * var(--u)) dashed var(--pd-maroon);
          background: transparent;
          color: var(--pd-ink);
          font-weight: 700;
          font-size: calc(13 * var(--u));
          text-transform: uppercase;
          cursor: pointer;
        }
      `}</style>

      <div className="photos-field-group">
        <span className="photos-field-label">Drag and drop</span>

        <div
          className={`photos-dropzone ${dragging ? "photos-dropzone-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={openBrowser}
          role="button"
          tabIndex={0}
          aria-label="Choose photos to upload"
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openBrowser();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="photos-hidden-input"
            tabIndex={-1}
            onClick={event => event.stopPropagation()}
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {photos.length === 0 ? (
            <span className="photos-choose-label">Choose photos<br /><small>JPG, PNG or WEBP · Up to 50 MB total</small></span>
          ) : (
            <div className="photos-grid">
              {photos.map((p) => (
                <div className="photos-thumb" key={p.id}>
                  <img src={p.url} alt="" />
                  <button
                    type="button"
                    className="photos-thumb-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(p.id);
                    }}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="photos-add-more"
                onClick={(e) => {
                  e.stopPropagation();
                  openBrowser();
                }}
              >
                + Add more
              </button>
            </div>
          )}
        </div>
      </div>
    </StampCardShell>
  );
}
