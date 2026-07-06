import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { fmtDate, fmtDateTime } from '../../lib/formatTime';
import Icon from '../Icon';
import { ImageLightbox } from '../shared/ImageLightbox';
import { MediaImage } from '../shared/MediaImage';
import { fileTypeIcon } from '../../lib/fileTypeIcon';
import { mediaUrl } from '../../lib/mediaUrl';
import { AudioPlayer } from './AudioPlayer';
import { URL_RE } from './chatRender';

const THUMB = 72;

function GoToMsgButton({ onClick, compact }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title="Перейти к сообщению"
      style={{
        background: compact ? 'rgba(22,15,50,.78)' : 'rgba(140,110,220,.32)',
        border: '1px solid rgba(200,170,255,.35)',
        borderRadius: compact ? 6 : 14,
        color: 'rgba(235,225,255,.95)',
        fontSize: compact ? 0 : 11,
        fontWeight: 600,
        padding: compact ? 4 : '4px 10px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {compact ? <Icon name="chat" size={13} /> : <>💬 К сообщению</>}
    </button>
  );
}

function MediaViewerModal({ convId, onClose }) {
  const [tab, setTab] = useState('images');
  const [imageItems, setImageItems] = useState([]); // { url, msgId, created_at }[]
  const [files, setFiles] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [light, setLight] = useState(null); // null | { urls, index, msgIds }

  function goToMessage(msgId) {
    if (!msgId) return;
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: msgId }));
    }, 50);
  }

  useEffect(() => {
    api.getMedia(convId).then(msgs => {
      const imgs = [], vids = [], fls = [], auds = [];
      for (const m of msgs) {
        const a = m.attachment;
        if (!a) continue;
        if (a.type === 'image' && a.url) {
          imgs.push({ url: a.url, msgId: m.id, created_at: m.created_at });
        } else if (a.type === 'images' && Array.isArray(a.urls)) {
          for (const url of a.urls.filter(Boolean)) {
            imgs.push({ url, msgId: m.id, created_at: m.created_at });
          }
        } else if (a.type === 'video') vids.push({ ...m, attachment: a });
        else if (a.type === 'file') fls.push({ ...m, attachment: a });
        else if (a.type === 'audio') auds.push({ ...m, attachment: a });
      }
      setImageItems(imgs);
      setVideos(vids);
      setFiles(fls);
      setAudios(auds);
      setLoading(false);
    }).catch(console.error);
    api.searchMessages(convId, 'http').then(msgs => {
      const found = [];
      msgs.forEach(m => {
        const urls = m.text?.match(URL_RE) || [];
        urls.forEach(url => found.push({
          url, sender: m.sender_name, time: m.created_at, message_id: m.id,
        }));
      });
      setLinks(found);
    }).catch(console.error);
  }, [convId]);

  const imageDays = useMemo(() => {
    const map = new Map();
    for (const item of imageItems) {
      const day = new Date(item.created_at * 1000).toDateString();
      if (!map.has(day)) map.set(day, { label: fmtDate(item.created_at), items: [] });
      map.get(day).items.push(item);
    }
    return Array.from(map.values());
  }, [imageItems]);

  const flatImageUrls = imageItems.map(i => i.url);
  const flatImageMsgIds = imageItems.map(i => i.msgId);

  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.6)',
    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modal = {
    width: 'min(94vw, 480px)', maxHeight: '80vh', background: 'rgba(45,36,80,.97)',
    borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 16px 48px rgba(0,0,0,.5)',
  };
  const listRow = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    borderRadius: 10, background: 'rgba(249,240,240,.06)',
    border: '1px solid rgba(249,240,240,.08)', cursor: 'pointer',
    transition: 'background .15s',
  };

  const TABS = [
    ['images', 'image', 'Фото', imageItems.length],
    ['videos', 'image', 'Видео', videos.length],
    ['files', 'attach', 'Файлы', files.length],
    ['audios', 'mic', 'Аудио', audios.length],
    ['links', 'link', 'Ссылки', links.length],
  ];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 0' }}>
          <span style={{ flex: 1, color: '#F9F0F0', fontSize: 17, fontWeight: 600 }}>Медиа и ссылки</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(249,240,240,.6)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          }}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div style={{
          display: 'flex', gap: 0, padding: '10px 8px 0',
          borderBottom: '1px solid rgba(249,240,240,.1)',
        }}>
          {TABS.map(([id, icon, label, count]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: tab === id ? '#F9F0F0' : 'rgba(249,240,240,.5)',
              borderBottom: tab === id ? '2px solid rgba(180,140,220,.9)' : '2px solid transparent',
              marginBottom: -1, transition: 'color .15s',
              fontWeight: tab === id ? 600 : 500,
              minWidth: 0,
            }}>
              <span style={{
                lineHeight: 1, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', height: 20,
              }}>
                <Icon name={icon} size={18} />
              </span>
              <span style={{
                fontSize: 11, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>
                {label}{count > 0 ? ` · ${count}` : ''}
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Загрузка…</div>
          )}

          {!loading && tab === 'images' && (
            imageItems.length === 0
              ? <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Нет фото</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {imageDays.map((day, di) => (
                    <div key={di}>
                      <div style={{
                        textAlign: 'center', marginBottom: 8,
                        color: 'rgba(225,220,245,.75)', fontSize: 12, fontWeight: 600,
                      }}>
                        {day.label}
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB}px, 1fr))`,
                        gap: 4,
                      }}>
                        {day.items.map((item, ii) => {
                          const globalIdx = imageItems.findIndex(
                            x => x.url === item.url && x.msgId === item.msgId,
                          );
                          return (
                            <div
                              key={`${item.msgId}-${ii}`}
                              style={{
                                position: 'relative', width: '100%', aspectRatio: '1',
                                borderRadius: 8, overflow: 'hidden', background: '#1a0a30',
                              }}
                            >
                              <MediaImage
                                src={item.url}
                                alt=""
                                onClick={() => setLight({
                                  urls: flatImageUrls,
                                  index: globalIdx >= 0 ? globalIdx : 0,
                                  msgIds: flatImageMsgIds,
                                })}
                                style={{
                                  width: '100%', height: '100%', objectFit: 'cover',
                                  display: 'block', cursor: 'zoom-in',
                                }}
                              />
                              <div style={{ position: 'absolute', bottom: 3, right: 3 }}>
                                <GoToMsgButton compact onClick={() => goToMessage(item.msgId)} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}

          {!loading && tab === 'videos' && (
            videos.length === 0
              ? <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Нет видео</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {videos.map(m => {
                    const a = m.attachment;
                    const src = mediaUrl(a.url);
                    return (
                      <div key={m.id} style={{ ...listRow, cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }}>
                        {src ? (
                          <video src={src} controls playsInline
                            style={{ width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }}
                          />
                        ) : (
                          <div style={{ color: 'rgba(225,220,245,.7)', fontSize: 13 }}>🎬 Видео недоступно</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <div style={{ flex: 1, minWidth: 0, color: 'rgba(225,220,245,.75)', fontSize: 11 }}>
                            {a.name || 'Видео'}
                            {m.sender_name ? ` · ${m.sender_name}` : ''} · {fmtDateTime(m.created_at)}
                          </div>
                          <GoToMsgButton compact onClick={() => goToMessage(m.id)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          )}

          {!loading && tab === 'files' && (
            files.length === 0
              ? <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Нет файлов</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {files.map(m => {
                    const a = m.attachment;
                    return (
                      <div
                        key={m.id}
                        onClick={() => goToMessage(m.id)}
                        title="Перейти к сообщению"
                        style={listRow}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,240,240,.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,240,240,.06)'; }}
                      >
                        <span style={{ flexShrink: 0, lineHeight: 1, display: 'inline-flex' }}>
                          {fileTypeIcon(a.name, a.mime, 22)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#F9F0F0', fontSize: 13, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {a.name || 'Файл'}
                          </div>
                          <div style={{ color: 'rgba(225,220,245,.7)', fontSize: 11, marginTop: 2 }}>
                            {fmtSize(a.size)}
                            {m.sender_name ? ` · ${m.sender_name}` : ''} · {fmtDateTime(m.created_at)}
                          </div>
                        </div>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          download={a.name}
                          onClick={e => e.stopPropagation()}
                          title="Скачать"
                          style={{
                            color: 'rgba(225,220,245,.85)', fontSize: 14, padding: '5px 8px',
                            borderRadius: 8, textDecoration: 'none',
                            background: 'rgba(249,240,240,.08)', flexShrink: 0,
                          }}
                        >
                          ⬇
                        </a>
                        <GoToMsgButton compact onClick={() => goToMessage(m.id)} />
                      </div>
                    );
                  })}
                </div>
              )
          )}

          {!loading && tab === 'audios' && (
            audios.length === 0
              ? <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Нет голосовых</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {audios.map(m => (
                    <div
                      key={m.id}
                      style={{
                        ...listRow,
                        cursor: 'default',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,240,240,.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,240,240,.06)'; }}
                    >
                      <span style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: 'rgba(140,110,220,.22)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(220,200,255,.9)',
                      }}>
                        <Icon name="mic" size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                        <AudioPlayer
                          url={m.attachment.url}
                          duration={m.attachment.duration}
                          waveform={m.attachment.waveform}
                          isOut={false}
                        />
                        <div style={{ color: 'rgba(225,220,245,.7)', fontSize: 11, marginTop: 4 }}>
                          {m.sender_name || ''} · {fmtDateTime(m.created_at)}
                        </div>
                      </div>
                      <GoToMsgButton onClick={() => goToMessage(m.id)} />
                    </div>
                  ))}
                </div>
              )
          )}

          {!loading && tab === 'links' && (
            links.length === 0
              ? <div style={{ color: 'rgba(225,220,245,.7)', textAlign: 'center', padding: 40 }}>Нет ссылок</div>
              : links.map((l, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(249,240,240,.08)' }}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'rgba(160,130,220,.95)', fontSize: 13, wordBreak: 'break-all',
                      textDecoration: 'none', fontWeight: 500,
                    }}
                  >
                    {l.url}
                  </a>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <div style={{ flex: 1, color: 'rgba(225,220,245,.7)', fontSize: 12 }}>
                      {l.sender} · {fmtDateTime(l.time)}
                    </div>
                    {l.message_id && <GoToMsgButton onClick={() => goToMessage(l.message_id)} />}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {light && (() => {
        const { urls, index } = light;
        const curUrl = urls[index];
        return (
          <div onClick={e => e.stopPropagation()}>
            <ImageLightbox
              urls={urls}
              index={index}
              onClose={() => setLight(null)}
              onIndexChange={(i) => setLight({ urls, index: i, msgIds: light.msgIds })}
              zIndex={600}
            >
              {light.msgIds?.[index] && (
                <button
                  onClick={() => goToMessage(light.msgIds[index])}
                  style={{
                    background: 'rgba(140,110,220,.7)', border: 'none', borderRadius: 10,
                    padding: '8px 18px', color: '#F9F0F0', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  💬 К сообщению
                </button>
              )}
              <a
                href={curUrl}
                download
                style={{
                  background: 'rgba(249,240,240,.15)', borderRadius: 10,
                  padding: '8px 18px', color: '#F9F0F0', textDecoration: 'none', fontSize: 14,
                }}
              >
                ⬇ Скачать
              </a>
            </ImageLightbox>
          </div>
        );
      })()}
    </div>
  );
}

export default MediaViewerModal;
