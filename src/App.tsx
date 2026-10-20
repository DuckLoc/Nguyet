import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronDown,
  Heart,
  ImagePlus,
  LockKeyhole,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { content } from './content'
import './App.css'

type StoredPhoto = {
  id: string
  blob: Blob
  caption: string
  createdAt: number
}

type Photo = StoredPhoto & { url: string }
type GalleryPhoto = { id: string; src: string; caption: string; upload?: Photo }

const DATABASE_NAME = 'anh-nguyet-gallery'
const STORE_NAME = 'photos'
const MAX_FILE_SIZE = 12 * 1024 * 1024

function openGalleryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt này không hỗ trợ lưu ảnh cục bộ.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể mở kho ảnh.'))
  })
}

async function galleryRequest<T>(
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openGalleryDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const request = operation(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể cập nhật kho ảnh.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Không thể lưu thay đổi ảnh.'))
    }
  })
}

function App() {
  const [opened, setOpened] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activePhoto, setActivePhoto] = useState(-1)
  const [secretRevealed, setSecretRevealed] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoUrls = useRef<string[]>([])
  const galleryPhotos: GalleryPhoto[] = [
    ...content.media
      .filter((item) => item.type === 'image')
      .map((item) => ({ id: item.src, src: item.src, caption: item.caption })),
    ...photos.map((photo) => ({
      id: photo.id,
      src: photo.url,
      caption: photo.caption,
      upload: photo,
    })),
  ]

  useEffect(() => {
    let cancelled = false
    void galleryRequest<StoredPhoto[]>((store) => store.getAll())
      .then((saved) => {
        if (!cancelled) {
          const restored = saved.sort((a, b) => a.createdAt - b.createdAt).map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }))
          photoUrls.current.push(...restored.map((photo) => photo.url))
          setPhotos(restored)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setGalleryError(error instanceof Error ? error.message : 'Không thể tải ảnh đã lưu.')
      })
    return () => {
      cancelled = true
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
    // Load persisted photos once, then release their preview URLs when the page closes.
  }, [])

  useEffect(() => {
    if (!galleryPhotos.length) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhoto(-1)
      if (event.key === 'ArrowRight') setActivePhoto((index) => (index + 1) % galleryPhotos.length)
      if (event.key === 'ArrowLeft') setActivePhoto((index) => (index - 1 + galleryPhotos.length) % galleryPhotos.length)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [galleryPhotos.length])

  const openLetter = () => {
    setOpened(true)
    window.setTimeout(() => document.getElementById('greeting')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setGalleryError('')
    setIsSaving(true)
    try {
      const accepted: File[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setGalleryError(`"${file.name}" không phải tệp ảnh nên đã được bỏ qua.`)
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          setGalleryError(`"${file.name}" lớn hơn 12 MB nên đã được bỏ qua.`)
          continue
        }
        accepted.push(file)
      }

      const newPhotos: Photo[] = accepted.map((blob) => ({
        id: crypto.randomUUID(),
        blob,
        caption: '',
        createdAt: Date.now(),
        url: URL.createObjectURL(blob),
      }))
      photoUrls.current.push(...newPhotos.map((photo) => photo.url))
      for (const photo of newPhotos) {
        await galleryRequest((store) => store.add({
          id: photo.id,
          blob: photo.blob,
          caption: photo.caption,
          createdAt: photo.createdAt,
        }))
      }
      setPhotos((current) => [...current, ...newPhotos])
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Không thể lưu ảnh. Hãy thử lại.')
    } finally {
      setIsSaving(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const updateCaption = async (photo: Photo, caption: string) => {
    const updated = { ...photo, caption }
    setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, caption } : item))
    try {
      await galleryRequest((store) => store.put({
        id: updated.id,
        blob: updated.blob,
        caption: updated.caption,
        createdAt: updated.createdAt,
      }))
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Không thể lưu chú thích.')
    }
  }

  const deletePhoto = async (photo: Photo) => {
    try {
      await galleryRequest((store) => store.delete(photo.id))
      URL.revokeObjectURL(photo.url)
      photoUrls.current = photoUrls.current.filter((url) => url !== photo.url)
      setPhotos((current) => current.filter((item) => item.id !== photo.id))
      setActivePhoto(-1)
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Không thể xóa ảnh.')
    }
  }

  return (
    <MotionConfig reducedMotion="user">
    <main>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Về đầu trang">
          <span className="brand-mark"><Heart size={17} fill="currentColor" /></span>
          <span>Gửi Ánh Nguyệt</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#letter">Lời chúc</a>
          <a href="#moments">Vài lời</a>
          <a href="#gallery">Ảnh &amp; video</a>
        </nav>
        <a className="topbar-date" href="#greeting">20.10 <span>♡</span></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Sparkles size={14} /> {content.eyebrow}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            {content.headline}<br /><em>{content.headlineAccent}</em>
          </motion.h1>
          <motion.p className="hero-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            {content.intro}
          </motion.p>
          <motion.button className="button button-primary" onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Camera size={17} /> Xem album <ArrowDown size={16} />
          </motion.button>
          <div className="hero-signoff"><span className="signoff-line" /> 20/10 · {content.recipient}</div>
        </div>

        <div className="hero-showcase">
          <motion.div className="hero-photo-shell" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: [0, -7, 0], scale: 1 }} transition={{ opacity: { duration: 0.8, delay: 0.18 }, scale: { duration: 1.1, delay: 0.18, ease: [0.22, 1, 0.36, 1] }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}>
            <motion.div className="hero-photo-tilt" animate={{ rotateY: [0, -7, 0, 7, 0], rotateX: [0, 2.5, 0, -2.5, 0], z: 28 }} transition={{ rotateY: { duration: 12, repeat: Infinity, ease: 'easeInOut' }, rotateX: { duration: 12, repeat: Infinity, ease: 'easeInOut' } }}>
              <div className="hero-photo-frame">
                <img src={content.coverImage} alt={`Ảnh của ${content.recipient}`} fetchPriority="high" />
                <div className="hero-photo-shade" />
              </div>
            </motion.div>
          </motion.div>
          <motion.div className="hero-photo-info" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: [0, -7, 0], scale: 1 }} transition={{ opacity: { duration: 0.8, delay: 0.18 }, scale: { duration: 1.1, delay: 0.18, ease: [0.22, 1, 0.36, 1] }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}>
            <div className="hero-photo-info-plane">
              <span className="hero-edition">ALBUM 20/10</span>
              <div className="hero-photo-caption"><span>20/10</span><strong>{content.recipient}</strong></div>
            </div>
          </motion.div>
          <motion.div className="hero-photo-count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ opacity: { delay: 0.65, duration: 0.45 } }}><span>ẢNH</span><strong>{String(content.media.filter((item) => item.type === 'image').length).padStart(2, '0')}</strong></motion.div>
          <motion.div className="hero-side-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.5 }}><div className="hero-side-note-card"><Heart size={14} /><span>Ảnh và video<br />20/10</span></div></motion.div>
        </div>
        <div className="hero-bottom"><span>20 THÁNG 10</span><span className="hero-bottom-heart">·</span><span>GỬI ÁNH NGUYỆT</span><span className="hero-bottom-count">{content.media.filter((item) => item.type === 'image').length} ẢNH · {content.media.filter((item) => item.type === 'video').length} VIDEO</span></div>
      </section>

      <section className="greeting section-wrap" id="greeting">
        <div className="section-kicker"><span>01</span> MỞ THIỆP</div>
        <AnimatePresence>
          {!opened ? (
            <motion.button className="envelope" onClick={openLetter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.92 }} aria-label="Mở thiệp chúc mừng">
              <div className="envelope-seal"><Heart size={25} fill="currentColor" /></div>
              <span>Xem lời chúc</span><ChevronDown size={17} />
            </motion.button>
          ) : (
            <motion.div className="greeting-card" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
              <span className="greeting-spark"><Sparkles size={20} /></span>
              <p className="script-line">{content.greeting}</p>
              <h2>{content.recipient}</h2>
              <p className="greeting-copy">Chúc em hôm nay vui, ăn ngon và đừng làm việc nhiều quá nhé.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="letter-section section-wrap" id="letter">
        <div className="letter-flower" aria-hidden="true">✿</div>
        <div className="section-kicker"><span>02</span> GỬI ÁNH NGUYỆT</div>
        <motion.div className="letter-paper" initial={{ opacity: 0, y: 24, rotateX: 10 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
          <div className="letter-paper-top"><span>20 THÁNG 10</span><Heart size={17} /></div>
          <h2>{content.letterTitle}</h2>
          {content.letter.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <div className="letter-signature"><span>— {content.sender}</span></div>
        </motion.div>
      </section>

      <section className="timeline-section section-wrap" id="moments">
        <div className="section-kicker"><span>03</span> VÀI DÒNG</div>
        <div className="section-heading">
          <h2>{content.momentsTitle}</h2><p>{content.momentsSubtitle}</p>
        </div>
        <div className="timeline-list">
          {content.moments.map((moment, index) => (
            <motion.article className="timeline-item" key={moment.title} initial={{ opacity: 0, y: 18, rotateY: index % 2 === 0 ? -12 : 12 }} whileInView={{ opacity: 1, y: 0, rotateY: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.12, duration: 0.65 }}>
              <span className="timeline-dot"><Heart size={13} fill="currentColor" /></span>
              <span className="timeline-number">0{index + 1}</span><div><h3>{moment.title}</h3><p>{moment.text}</p></div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="gallery-section section-wrap" id="gallery">
        <div className="section-kicker"><span>04</span> ALBUM</div>
        <div className="gallery-heading">
          <div className="section-heading"><h2>Ảnh và video</h2><p>Anh gom lại ở đây để em tiện xem.</p></div>
          <label className={`button button-outline ${isSaving ? 'is-disabled' : ''}`}>
            <ImagePlus size={17} /> {isSaving ? 'Đang lưu…' : 'Thêm ảnh'}
            <input ref={fileInput} type="file" accept="image/*" multiple onChange={(event) => void addPhotos(event.target.files)} disabled={isSaving} />
          </label>
        </div>
        {galleryError && <p className="gallery-error" role="alert">{galleryError}</p>}
        <div className="photo-grid">
            {galleryPhotos.map((photo, index) => (
              <motion.article className={`photo-card ${photo.upload ? 'photo-card-upload' : ''}`} key={photo.id} initial={{ opacity: 0, y: 22, scale: 0.94, rotateY: index % 2 === 0 ? -10 : 10, rotateX: 5 }} whileInView={{ opacity: 1, y: 0, scale: 1, rotateY: 0, rotateX: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.62, delay: Math.min(index % 4, 3) * 0.07, ease: 'easeOut' }}>
                <button className="photo-preview" onClick={() => setActivePhoto(index)} aria-label={`Xem ảnh ${index + 1}`}>
                  <img src={photo.src} alt={photo.caption || `Ảnh ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" /><span className="photo-zoom"><Camera size={18} /></span>
                </button>
                {photo.upload ? (
                  <div className="photo-caption-row">
                    <input value={photo.caption} maxLength={120} placeholder="Thêm chú thích…" aria-label={`Chú thích ảnh ${index + 1}`} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.upload?.id ? { ...item, caption: event.target.value } : item))} onBlur={(event) => photo.upload && void updateCaption(photo.upload, event.target.value)} />
                    <button className="icon-button delete-button" onClick={() => photo.upload && void deletePhoto(photo.upload)} aria-label="Xóa ảnh"><Trash2 size={16} /></button>
                  </div>
                ) : <div className="photo-caption-row"><span className="bundled-caption">{photo.caption}</span><span className="bundled-label">ĐÃ CÓ SẴN</span></div>}
              </motion.article>
            ))}
        </div>
        {content.media.filter((item) => item.type === 'video').map((video) => (
          <motion.article className="video-card" key={video.src} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55 }}>
            <video controls playsInline preload="none" poster={content.coverImage}>
              <source src={video.src} type="video/mp4" />
              Trình duyệt của bạn không hỗ trợ phát video này.
            </video>
            <div className="video-caption"><span><Sparkles size={14} /> VIDEO</span><strong>{video.caption}</strong></div>
          </motion.article>
        ))}
      </section>

      <section className="secret-section section-wrap">
        <div className="secret-card">
          <div className="secret-decoration">✿</div>
          <div className="section-kicker"><span>05</span> LỜI NHẮN</div>
          <LockKeyhole size={23} className="secret-lock" />
          <h2>{content.secretTitle}</h2>
          <AnimatePresence mode="wait">
            {secretRevealed ? (
              <motion.p className="secret-message" key="message" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{content.secretMessage}</motion.p>
            ) : (
              <motion.button className="button button-primary secret-button" key="button" onClick={() => setSecretRevealed(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Xem lời nhắn <Heart size={15} /></motion.button>
            )}
          </AnimatePresence>
          <span className="secret-heart">♡</span>
        </div>
      </section>

      <footer className="footer section-wrap">
        <span className="footer-heart"><Heart size={19} fill="currentColor" /></span>
        <p>{content.closing}</p><span className="footer-recipient">{content.recipient}</span>
        <span className="footer-rule" /><small>{content.footer}</small>
      </footer>

      <AnimatePresence>
        {activePhoto >= 0 && galleryPhotos[activePhoto] && (
          <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh lớn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActivePhoto(-1)}>
            <button className="lightbox-close icon-button" onClick={() => setActivePhoto(-1)} aria-label="Đóng"><X /></button>
            <button className="lightbox-arrow lightbox-prev icon-button" onClick={(event) => { event.stopPropagation(); setActivePhoto((activePhoto - 1 + galleryPhotos.length) % galleryPhotos.length) }} aria-label="Ảnh trước"><ArrowLeft /></button>
            <motion.figure className="lightbox-figure" onClick={(event) => event.stopPropagation()} initial={{ scale: 0.96 }} animate={{ scale: 1 }}>
              <img src={galleryPhotos[activePhoto].src} alt={galleryPhotos[activePhoto].caption || 'Ảnh trong album'} />
              {galleryPhotos[activePhoto].caption && <figcaption>{galleryPhotos[activePhoto].caption}</figcaption>}
            </motion.figure>
            <button className="lightbox-arrow lightbox-next icon-button" onClick={(event) => { event.stopPropagation(); setActivePhoto((activePhoto + 1) % galleryPhotos.length) }} aria-label="Ảnh tiếp theo"><ArrowRight /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{opened ? 'Thiệp đã mở' : ''}</span>
    </main>
    </MotionConfig>
  )
}

export default App
