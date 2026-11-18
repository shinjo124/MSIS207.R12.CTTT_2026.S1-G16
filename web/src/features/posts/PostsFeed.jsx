import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import DestinationPicker from '../trips/DestinationPicker.jsx';
import { displayName } from '../trips/destination-search.js';

function mergeById(current, incoming) {
  return [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()];
}

export default function PostsFeed({ getToken, isSignedIn = false, profileStatus = 'signed-out', profileError = '' }) {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [likeBusy, setLikeBusy] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [commentOffsets, setCommentOffsets] = useState({});
  const [openComments, setOpenComments] = useState(() => new Set());
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoading, setCommentsLoading] = useState(() => new Set());
  const [commentDrafts, setCommentDrafts] = useState({});
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerMessage, setComposerMessage] = useState('');
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
    if (!canWrite) return undefined;
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
  }, [canWrite, getToken]);

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

  const loadPosts = useCallback(async (signal, page = 1) => {
    setPostsLoading(true);
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
      if (!signal?.aborted) setPostsLoading(false);
    }
  }, [getToken, canWrite]);

  useEffect(() => {
    const controller = new AbortController();
    loadPosts(controller.signal);
    return () => controller.abort();
  }, [loadPosts]);

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
    setError('');
    if (!body) return setComposerMessage('Write a few words before publishing.');
    if (image?.size > 4 * 1024 * 1024) return setComposerMessage('Choose an image of 4 MB or smaller.');
    if (image instanceof File && image.size && !altText) {
      return setComposerMessage('Add a descriptive alt text for this photo.');
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
      setDestinationId('');
      setPlaceId('');
      setComposerMessage('Your story is published.');
      await loadPosts();
    } catch (requestError) {
      setComposerMessage(requestError.message);
    } finally {
      setComposerBusy(false);
    }
  }

  async function likePost(post) {
    if (!canWrite || likeBusy !== null) return;
    setLikeBusy(post.id);
    setError('');
    try {
      const { data } = await apiRequest(`/posts/${post.id}/likes?summary=1`, { method: post.liked ? 'DELETE' : 'POST', getToken });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, ...data }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLikeBusy(null);
    }
  }

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
        <div><p className="eyebrow">NOTES FROM THE ROAD</p><h2 id="stories-title">Small moments, well kept.</h2></div>
        <p>Stories shared by travelers.</p>
      </div>
      {canWrite && <form className="story-composer" onSubmit={createPost}>
        <label>Write a travel story<textarea name="body" maxLength="2000" rows="3" required placeholder="A place, a moment, a recommendation…" /></label>
        <div className="composer-fields">
          <label>Trip (optional)
            <select name="tripId" defaultValue="" disabled={linksLoading || linksUnavailable}>
              <option value="">{linksLoading ? 'Loading trips…' : linkedTrips.length ? 'Do not link a trip' : 'No trips to link'}</option>
              {linkedTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
            </select>
          </label>
          <div className="composer-destination">
            <span id="story-destination-label">Destination (optional)</span>
            <DestinationPicker
              max={1}
              showPlaces={false}
              options={destinations}
              labelledBy="story-destination-label"
              disabled={linksLoading || linksUnavailable}
              placeholder={linksLoading ? 'Loading destinations…' : 'Type a place, e.g. Đà Lạt, da lat, H…'}
              selected={(() => {
                const chosen = destinations.find((destination) => String(destination.id) === destinationId);
                return chosen ? [{ id: chosen.id, name: displayName(chosen) }] : [];
              })()}
              onChange={(list) => { setDestinationId(list[0] ? String(list[0].id) : ''); setPlaceId(''); }}
            />
          </div>
          {destinationId && <label>Place (optional)
            <select name="placeId" value={placeId} disabled={placesLoading || placesUnavailable} onChange={(event) => setPlaceId(event.target.value)}>
              <option value="">{placesLoading ? 'Loading places…' : placesUnavailable ? 'Places unavailable right now' : places.length ? 'Do not link a place' : 'No places for this destination'}</option>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
            </select>
          </label>}
          <label>Photo (up to 4 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label>Photo description <input name="altText" maxLength="255" placeholder="Describe the photo for screen readers" /></label>
        </div>
        {linksUnavailable && <p className="story-signin-note" role="status">Trip or place links are unavailable right now. You can still publish without linking them.</p>}
        <button type="submit" disabled={composerBusy || postsLoading}>{composerBusy ? 'Publishing…' : 'Publish story'}</button>
        {composerMessage && <p role="status">{composerMessage}</p>}
      </form>}
      {status === 'loading' && <p className="empty-state" role="status">Loading stories…</p>}
      {status === 'error' && <p className="empty-state error-state" role="alert">Stories are unavailable right now.</p>}
      {status === 'empty' && <p className="empty-state">New travel stories will show up here.</p>}
      {error && <p className="empty-state error-state" role="alert">{error}</p>}
      {!isSignedIn && <p className="story-signin-note">Sign in to publish, like, or comment on a story.</p>}
      {isSignedIn && profileStatus === 'loading' && <p className="story-signin-note" role="status">Setting up your profile…</p>}
      {isSignedIn && profileStatus === 'error' && <p className="story-signin-note" role="alert">Profile setup failed: {profileError || 'Check the API connection and try again.'}</p>}
      {status === 'ready' && <div className="story-grid">
        {posts.map((post) => (
          <article className="story-card" key={post.id}>
            {post.photos?.[0] && <img src={post.photos[0].imageUrl} alt={post.photos[0].altText} loading="lazy" />}
            <p className="story-byline">{post.author} <span>· {new Date(post.createdAt).toLocaleDateString()}</span></p>
            <p className="story-body">{post.body}</p>
            <div className="story-actions">
              <span className="story-stats">{post.likesCount} likes <span>·</span> {post.commentsCount} comments</span>
              {canWrite && <button type="button" onClick={() => likePost(post)} disabled={likeBusy !== null || postsLoading} aria-pressed={Boolean(post.liked)}>
                {post.liked ? 'Unlike' : 'Like'}
              </button>}
              <button type="button" onClick={() => toggleComments(post.id)}>
                {openComments.has(post.id) ? 'Hide comments' : 'Comments'}
              </button>
            </div>
            {openComments.has(post.id) && <div className="story-comments">
              {commentsLoading.has(post.id) && <p role="status">Loading comments…</p>}
              {(commentsByPost[post.id] || []).map((comment) => (
                <p className="story-comment" key={comment.id}><strong>{comment.author}</strong> {comment.body}</p>
              ))}
              {!commentsLoading.has(post.id) && commentsByPost[post.id]?.length === 0 && <p>No comments yet.</p>}
              {commentOffsets[post.id] != null && <button type="button" disabled={commentsLoading.has(post.id)}
                onClick={() => loadComments(post.id, commentOffsets[post.id])}>Load more comments</button>}
              {canWrite && <form onSubmit={(event) => addComment(event, post.id)}>
                <label className="visually-hidden" htmlFor={`comment-${post.id}`}>Write a comment</label>
                <input id={`comment-${post.id}`} name="body" maxLength="1000" required placeholder="Write a comment…"
                  value={commentDrafts[post.id] || ''}
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} />
                <button type="submit">Send</button>
              </form>}
            </div>}
          </article>
        ))}
      </div>}
      {nextPage && <button type="button" disabled={postsLoading || composerBusy} onClick={() => loadPosts(undefined, nextPage)}>Load more stories</button>}
    </section>
  );
}
