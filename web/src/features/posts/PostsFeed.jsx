import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { feedImageSources } from '../../lib/cloudinary-image.js';
import DestinationPicker from '../trips/DestinationPicker.jsx';
import { displayName } from '../trips/destination-search.js';
import { categoryLabel, formatDateTime } from '../trips/trip-format.js';
import '../trips/trips.css';
import { t } from '../../lib/i18n.js';

export function StoryImage({ photo, priority }) {
  const [fallback, setFallback] = useState(false);
  const sources = fallback ? null : feedImageSources(photo.imageUrl);
  return <img src={sources?.src || photo.imageUrl} srcSet={sources?.srcSet} sizes={sources?.sizes}
    alt={photo.altText} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined}
    decoding="async" onError={sources ? () => setFallback(true) : undefined} />;
}

export function galleryPhotoIndex(scrollLeft, width, count) {
  return width ? Math.max(0, Math.min(count - 1, Math.round(scrollLeft / width))) : 0;
}

export function StoryGallery({ photos, priority }) {
  const gallery = useRef(null);
  const [current, setCurrent] = useState(0);
  if (!photos?.length) return null;
  function move(direction) {
    const element = gallery.current;
    const index = galleryPhotoIndex(element.scrollLeft, element.clientWidth, photos.length);
    element.scrollTo({ left: (index + direction) * element.clientWidth, behavior: 'smooth' });
  }
  return <div className="story-gallery-wrap">
    <div className="story-gallery" ref={gallery} role="region" aria-label={t("Story photos")} tabIndex={photos.length > 1 ? 0 : undefined}
      onScroll={(event) => setCurrent(galleryPhotoIndex(event.currentTarget.scrollLeft, event.currentTarget.clientWidth, photos.length))}>
      {photos.map((photo, index) => <StoryImage key={`${photo.imageUrl}-${index}`} photo={photo} priority={priority && index === 0} />)}
    </div>
    {photos.length > 1 && <div className="story-gallery-controls">
      <button type="button" aria-label={t("Previous photo")} disabled={current === 0} onClick={() => move(-1)}>{t("Previous")}</button>
      <span aria-live="polite">{current + 1} / {photos.length}</span>
      <button type="button" aria-label={t("Next photo")} disabled={current >= photos.length - 1} onClick={() => move(1)}>{t("Next")}</button>
    </div>}
  </div>;
}

// Use IDs to merge pages without rendering duplicate posts or comments.
function mergeById(current, incoming) {
  return [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()];
}

export default function PostsFeed({ getToken, isSignedIn = false, profileStatus = 'signed-out', profileError = '' }) {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [likeBusy, setLikeBusy] = useState(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState(null);
  const [deletePostBusy, setDeletePostBusy] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editPostBusy, setEditPostBusy] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [commentOffsets, setCommentOffsets] = useState({});
  const [openComments, setOpenComments] = useState(() => new Set());
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoading, setCommentsLoading] = useState(() => new Set());
  const [commentDrafts, setCommentDrafts] = useState({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerMessage, setComposerMessage] = useState('');
  const [composerSuccess, setComposerSuccess] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const photoInput = useRef(null);
  const loadMoreSentinel = useRef(null);
  const loadingMore = useRef(false);
  const [linkedTrips, setLinkedTrips] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [places, setPlaces] = useState([]);
  const [destinationId, setDestinationId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksUnavailable, setLinksUnavailable] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);
  const canWrite = isSignedIn && profileStatus === 'ready';

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return undefined; }
    // The preview lives in the browser until publication. Revoke its URL when the file changes.
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    setComposerMessage('');
    setComposerSuccess(false);
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      event.target.value = '';
      setPhoto(null);
      setComposerMessage(t('Choose a JPEG, PNG, or WebP image of 4 MB or smaller.'));
      return;
    }
    setPhoto(file || null);
  }

  useEffect(() => {
    if (!canWrite || !composerOpen) return undefined;
    const controller = new AbortController();
    setLinksLoading(true);
    Promise.allSettled([
      apiRequest('/trips', { getToken, signal: controller.signal }),
      apiRequest('/destinations?scope=all', { signal: controller.signal }),
    ]).then(([tripsResult, destinationsResult]) => {
      if (controller.signal.aborted) return;
      const unavailable = tripsResult.status === 'rejected' || destinationsResult.status === 'rejected';
      setLinkedTrips(unavailable ? [] : tripsResult.value.data || []);
      setDestinations(unavailable ? [] : destinationsResult.value.data || []);
      setLinksUnavailable(unavailable);
      setLinksLoading(false);
    });
    return () => controller.abort();
  }, [canWrite, composerOpen, getToken]);

  useEffect(() => {
    if (!destinationId) {
      setPlaces([]);
      return undefined;
    }
    const controller = new AbortController();
    setPlacesLoading(true);
    setPlacesUnavailable(false);
    apiRequest(`/destinations/${encodeURIComponent(destinationId)}/places`, { signal: controller.signal })
      .then((result) => setPlaces(result.data || []))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setPlaces([]);
          setPlacesUnavailable(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesLoading(false);
      });
    return () => controller.abort();
  }, [destinationId]);

  // Page one replaces the feed. Later pages append while retaining already-visible stories.
  const loadPosts = useCallback(async (signal, page = 1) => {
    setPostsLoading(true);
    if (page > 1) setError('');
    try {
      const result = await apiRequest(`/posts?page=${page}`, { signal, getToken: canWrite ? getToken : undefined });
      if (signal?.aborted) return;
      setPosts((current) => page === 1 ? result.data : mergeById(current, result.data));
      setNextPage(result.hasMore ? page + 1 : null);
      setStatus(page > 1 || result.data.length ? 'ready' : 'empty');
    } catch (requestError) {
      if (!signal?.aborted) {
        if (page === 1) setStatus('error');
        else setError(requestError.message);
      }
    } finally {
      if (page > 1) loadingMore.current = false;
      if (!signal?.aborted) setPostsLoading(false);
    }
  }, [getToken, canWrite]);

  useEffect(() => {
    const controller = new AbortController();
    loadPosts(controller.signal);
    return () => controller.abort();
  }, [loadPosts]);

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || !nextPage || postsLoading || composerBusy || error || typeof IntersectionObserver === 'undefined') return undefined;
    // Start the next page before the sentinel is visible and stop duplicate requests while it loads.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingMore.current) return;
      loadingMore.current = true;
      observer.disconnect();
      loadPosts(undefined, nextPage);
    }, { rootMargin: '400px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [composerBusy, error, loadPosts, nextPage, postsLoading]);

  // Use multipart only for a story with an image. Both formats reach the same endpoint.
  async function createPost(event) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '').trim();
    const tripId = String(form.get('tripId') || '').trim();
    const placeId = String(form.get('placeId') || '').trim();
    const image = form.get('image');
    const altText = String(form.get('altText') || '').trim();
    setComposerMessage('');
    setComposerSuccess(false);
    setError('');
    if (!body) return setComposerMessage(t('Write a few words before publishing.'));
    if (image?.size > 4 * 1024 * 1024) return setComposerMessage(t('Choose an image of 4 MB or smaller.'));
    if (image instanceof File && image.size && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return setComposerMessage(t('Choose a JPEG, PNG, or WebP image.'));
    if (image instanceof File && image.size && !altText) {
      return setComposerMessage(t('Add a descriptive alt text for this photo.'));
    }

    setComposerBusy(true);
    try {
      if (image instanceof File && image.size) {
        const upload = new FormData();
        upload.set('body', body);
        upload.set('visibility', 'public');
        upload.set('altText', altText);
        if (tripId) upload.set('tripId', tripId);
        if (placeId) upload.set('placeId', placeId);
        upload.set('image', image);
        await apiRequest('/posts', { method: 'POST', body: upload, getToken });
      } else {
        await apiRequest('/posts', {
          method: 'POST', getToken,
          body: {
            body,
            visibility: 'public',
            tripId: tripId ? Number(tripId) : null,
            placeId: placeId ? Number(placeId) : null,
            photos: [],
          },
        });
      }
      formElement.reset();
      setPhoto(null);
      setDestinationId('');
      setPlaceId('');
      setComposerMessage(t('Your story is published.'));
      setComposerSuccess(true);
      await loadPosts();
    } catch (requestError) {
      setComposerMessage(requestError.message);
    } finally {
      setComposerBusy(false);
    }
  }

  // Show the like immediately, then use the server count or restore the previous value if saving fails.
  async function likePost(post) {
    if (!canWrite || likeBusy !== null) return;
    const nextLiked = !post.liked;
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, liked: nextLiked, likesCount: Math.max(0, Number(item.likesCount) + (nextLiked ? 1 : -1)) }
      : item));
    setLikeBusy(post.id);
    setError('');
    try {
      const { data } = await apiRequest(`/posts/${post.id}/likes?summary=1`, { method: nextLiked ? 'POST' : 'DELETE', getToken });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, ...data }
        : item));
    } catch (requestError) {
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, liked: post.liked, likesCount: post.likesCount }
        : item));
      setError(requestError.message);
    } finally {
      setLikeBusy(null);
    }
  }

  async function deletePost(post) {
    if (!canWrite || !post.isAuthor || deletePostBusy !== null) return;
    setDeletePostBusy(post.id);
    setError('');
    try {
      await apiRequest(`/posts/${post.id}`, { method: 'DELETE', getToken });
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setOpenComments((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletePostBusy(null);
      setConfirmDeletePostId(null);
    }
  }

  async function savePost(event, post) {
    event.preventDefault();
    if (!canWrite || !post.isAuthor || editPostBusy !== null) return;
    const body = editDraft.trim();
    if (!body) return setError(t('A story cannot be empty.'));
    setEditPostBusy(post.id);
    setError('');
    try {
      const result = await apiRequest(`/posts/${post.id}`, { method: 'PATCH', getToken, body: { body } });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, body: result.data.body } : item));
      setEditingPostId(null);
      setEditDraft('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEditPostBusy(null);
    }
  }

  // Load comments on first open. Reopening a thread reuses any comments already fetched.
  async function toggleComments(postId) {
    const opening = !openComments.has(postId);
    setOpenComments((current) => {
      const next = new Set(current);
      if (opening) next.add(postId); else next.delete(postId);
      return next;
    });
    if (opening && commentOffsets[postId] === undefined && !commentsLoading.has(postId)) await loadComments(postId);
  }

  async function loadComments(postId, offset = 0) {
    setCommentsLoading((current) => new Set(current).add(postId));
    try {
      const result = await apiRequest(`/posts/${postId}/comments?limit=20&offset=${offset}`);
      setCommentOffsets((current) => ({ ...current, [postId]: result.nextOffset }));
      setCommentsByPost((current) => ({ ...current, [postId]: mergeById(current[postId] || [], result.data).sort((a, b) => a.id - b.id) }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCommentsLoading((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    }
  }

  async function addComment(event, postId) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') || '').trim();
    if (!body || !canWrite) return;
    try {
      const result = await apiRequest(`/posts/${postId}/comments`, { method: 'POST', getToken, body: { body } });
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
      setCommentsByPost((current) => ({ ...current, [postId]: mergeById(current[postId] || [], [result.data]) }));
      setPosts((current) => current.map((item) => item.id === postId ? { ...item, commentsCount: Number(item.commentsCount) + 1 } : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="stories" aria-labelledby="stories-title">
      <div className="section-heading">
        <div><h2 id="stories-title">{t("Travel stories")}</h2><p>{t("Discover moments and recommendations from travelers.")}</p></div>
      </div>
      {canWrite && <div className="story-compose-area"><button className="story-compose-toggle" type="button" aria-expanded={composerOpen} aria-controls="story-composer" onClick={() => setComposerOpen((open) => !open)} disabled={composerBusy}>{composerOpen ? t("Close composer") : t("Share a travel story")}</button><form id="story-composer" className="story-composer" hidden={!composerOpen} onSubmit={createPost}>
        <label>{t("Write a travel story")}<textarea name="body" maxLength="2000" rows="3" required placeholder={t("A place, a moment, a recommendation…")} /></label>
        <div className="composer-fields">
          <label>{t("Trip (optional)")}
            <select name="tripId" defaultValue="" disabled={linksLoading || linksUnavailable}>
              <option value="">{linksLoading ? t("Loading trips…") : linkedTrips.length ? t("Do not link a trip") : t("No trips to link")}</option>
              {linkedTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
            </select>
          </label>
          <div className="composer-destination">
            <span id="story-destination-label">{t("Destination (optional)")}</span>
            <DestinationPicker
              max={1}
              showPlaces={false}
              options={destinations}
              labelledBy="story-destination-label"
              disabled={linksLoading || linksUnavailable}
              placeholder={linksLoading ? t("Loading destinations…") : t("Type a place…")}
              selected={(() => {
                const chosen = destinations.find((destination) => String(destination.id) === destinationId);
                return chosen ? [{ id: chosen.id, name: displayName(chosen) }] : [];
              })()}
              onChange={(list) => { setDestinationId(list[0] ? String(list[0].id) : ''); setPlaceId(''); }}
            />
          </div>
          {destinationId && <label>{t("Place (optional)")}
            <select name="placeId" value={placeId} disabled={placesLoading || placesUnavailable} onChange={(event) => setPlaceId(event.target.value)}>
              <option value="">{placesLoading ? t("Loading places…") : placesUnavailable ? t("Places unavailable right now") : places.length ? t("Do not link a place") : t("No places for this destination")}</option>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
            </select>
          </label>}
          <label>{t("Photo (JPEG, PNG or WebP, up to 4 MB)")} <input ref={photoInput} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} /></label>
          <label>{t("Photo description")} <input name="altText" maxLength="255" required={Boolean(photo)} placeholder={t("Describe the photo for screen readers")} /></label>
        </div>
        {photoUrl && <div className="story-photo-preview"><img src={photoUrl} alt={t("Selected photo preview")} /><button type="button" onClick={() => { photoInput.current.value = ''; setPhoto(null); }}>{t("Remove photo")}</button></div>}
        {linksUnavailable && <p className="story-signin-note" role="status">{t("Trip or place links are unavailable right now. You can still publish without linking them.")}</p>}
        <button type="submit" disabled={composerBusy || postsLoading}>{composerBusy ? t("Publishing…") : t("Publish story")}</button>
        {composerMessage && <p className={composerSuccess ? 'story-success' : 'error-state'} role={composerSuccess ? 'status' : 'alert'}>{composerMessage}</p>}
      </form></div>}
      {status === 'loading' && <p className="empty-state" role="status">{t("Loading stories…")}</p>}
      {status === 'error' && <p className="empty-state error-state" role="alert">{t("Stories are unavailable right now.")}</p>}
      {status === 'empty' && <p className="empty-state">{t("New travel stories will show up here.")}</p>}
      {error && <p className="empty-state error-state" role="alert">{error}</p>}
      {!isSignedIn && <p className="story-signin-note">{t("Sign in to publish, like, or comment on a story.")}</p>}
      {isSignedIn && profileStatus === 'loading' && <p className="story-signin-note" role="status">{t("Setting up your profile…")}</p>}
      {isSignedIn && profileStatus === 'error' && <p className="story-signin-note" role="alert">{t("Profile setup failed:")} {profileError || t("Check the API connection and try again.")}</p>}
      {status === 'ready' && <div className="story-grid">
        {posts.map((post, index) => (
          <article className="story-card" key={post.id}>
            <div className="story-author">
              {post.authorAvatar ? <img className="story-avatar" src={post.authorAvatar} alt="" /> : <span className="story-avatar" aria-hidden="true">{post.author?.trim().charAt(0).toUpperCase() || '?'}</span>}
              <p className="story-byline">{post.author} <span>{formatDateTime(post.createdAt, { dateStyle: 'medium' })}</span></p>
              {canWrite && post.isAuthor && <details className="story-post-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
                <summary aria-label={t('More options for your post by {author}', { author: post.author })} title={t("Post options")}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></summary>
                <div className="story-post-menu-panel">
                  <button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; setEditDraft(post.body); setEditingPostId(post.id); setConfirmDeletePostId(null); }}>{t("Edit post")}</button>
                  <button type="button" className="story-post-menu-delete" onClick={(event) => { event.currentTarget.closest('details').open = false; setConfirmDeletePostId(post.id); setEditingPostId(null); }}>{t("Delete post")}</button>
                </div>
              </details>}
            </div>
            {post.place && <StoryPlace place={post.place} />}
            <StoryGallery photos={post.photos} priority={index === 0} />
            {editingPostId === post.id
              ? <form className="story-edit-form" onSubmit={(event) => savePost(event, post)}>
                <label className="visually-hidden" htmlFor={`edit-story-${post.id}`}>{t("Edit your travel story")}</label>
                <textarea id={`edit-story-${post.id}`} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength="2000" rows="4" required autoFocus />
                <div><button type="submit" disabled={editPostBusy !== null}>{editPostBusy === post.id ? t("Saving…") : t("Save changes")}</button><button type="button" onClick={() => { setEditingPostId(null); setEditDraft(''); }} disabled={editPostBusy !== null}>{t("Cancel")}</button></div>
              </form>
              : <p className="story-body">{post.body}</p>}
            <div className="story-actions">
              <span className="story-stats">{t("{n} likes", { n: post.likesCount })} <span>·</span> {t("{n} comments", { n: post.commentsCount })}</span>
              {canWrite && <button type="button" onClick={() => likePost(post)} disabled={likeBusy !== null || postsLoading} aria-pressed={Boolean(post.liked)}>
                {likeBusy === post.id ? t("Saving…") : post.liked ? t("Unlike") : t("Like")}
              </button>}
              <button type="button" aria-expanded={openComments.has(post.id)} onClick={() => toggleComments(post.id)}>
                {openComments.has(post.id) ? t("Hide comments") : t("Comments")}
              </button>
            </div>
            {confirmDeletePostId === post.id && <div className="story-delete-confirmation" role="group" aria-label={t("Confirm story deletion")}>
              <span>{t("Delete this post?")}</span>
              <button type="button" className="story-delete-confirm" onClick={() => deletePost(post)} disabled={deletePostBusy !== null}>{deletePostBusy === post.id ? t("Deleting…") : t("Delete")}</button>
              <button type="button" onClick={() => setConfirmDeletePostId(null)} disabled={deletePostBusy !== null}>{t("Cancel")}</button>
            </div>}
            {openComments.has(post.id) && <div className="story-comments">
              {commentsLoading.has(post.id) && <p role="status">{t("Loading comments…")}</p>}
              {(commentsByPost[post.id] || []).map((comment) => (
                <p className="story-comment" key={comment.id}><strong>{comment.author}</strong> {comment.body}</p>
              ))}
              {!commentsLoading.has(post.id) && commentsByPost[post.id]?.length === 0 && <p>{t("No comments yet.")}</p>}
              {commentOffsets[post.id] != null && <button type="button" disabled={commentsLoading.has(post.id)}
                onClick={() => loadComments(post.id, commentOffsets[post.id])}>{t("Load more comments")}</button>}
              {canWrite && <form onSubmit={(event) => addComment(event, post.id)}>
                <label className="visually-hidden" htmlFor={`comment-${post.id}`}>{t("Write a comment")}</label>
                <input id={`comment-${post.id}`} name="body" maxLength="1000" required placeholder={t("Write a comment…")}
                  value={commentDrafts[post.id] || ''}
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} />
                <button type="submit">{t("Send")}</button>
              </form>}
            </div>}
          </article>
        ))}
      </div>}
      {nextPage && <div ref={loadMoreSentinel} className="story-load-sentinel" aria-live="polite">
        {postsLoading && <span role="status">{t("Loading more stories…")}</span>}
        {error && <button type="button" onClick={() => loadPosts(undefined, nextPage)}>{t("Retry loading stories")}</button>}
        {typeof IntersectionObserver === 'undefined' && !postsLoading && !error && <button type="button" onClick={() => loadPosts(undefined, nextPage)}>{t("Load more stories")}</button>}
      </div>}
    </section>
  );
}

// Where the story happened: the linked place, its type, address and destination, plus a map link.
function StoryPlace({ place }) {
  const destination = place.destination;
  const area = destination ? [destination.name, destination.region !== destination.name ? destination.region : null].filter(Boolean).join(', ') : '';
  const details = [categoryLabel(place.category), place.address, area].filter(Boolean);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery || [place.name, area].filter(Boolean).join(', '))}`;
  return <div className="story-place">
    <p className="story-place-name">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>
      <span>{place.name}</span>
    </p>
    {details.length > 0 && <p className="story-place-details">{details.join(' · ')}</p>}
    <a className="story-place-map" href={mapHref} target="_blank" rel="noreferrer">{t("Open in Google Maps")} <span aria-hidden="true">↗</span></a>
  </div>;
}
