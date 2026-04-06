import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import {
  reddit,
  context,
  createServer,
  getServerPort,
} from '@devvit/web/server';

const app = new Hono();
const internal = new Hono();

function isPostId(id: string): id is `t3_${string}` {
  return id.startsWith('t3_');
}

internal.post('/on-app-install', async (c) => {
  try {
    if (!context.subredditName) {
      throw new Error('context.subredditName is missing');
    }

    await reddit.submitCustomPost({
      subredditName: context.subredditName,
      title: 'Juicy Merge',
      entry: 'default',
    });

    return c.json({ ok: true }, 200);
  } catch {
    return c.json({ ok: false }, 500);
  }
});

internal.post('/menu/create-post', async (c) => {
  try {
    await c.req.json<MenuItemRequest>().catch(() => null);

    if (!context.subredditName) {
      throw new Error('context.subredditName is missing');
    }

    await reddit.submitCustomPost({
      subredditName: context.subredditName,
      title: 'Juicy Merge',
      entry: 'default',
    });

    return c.json<UiResponse>({
      showToast: {
        text: 'Juicy Merge post created successfully.',
        appearance: 'success',
      },
    }, 200);
  } catch {
    return c.json<UiResponse>({
      showToast: {
        text: 'Failed to create Juicy Merge post.',
        appearance: 'neutral',
      },
    }, 200);
  }
});

internal.post('/menu/remove-post', async (c) => {
  try {
    const body = await c.req.json<MenuItemRequest>();
    const postId = body.targetId;

    if (!postId || !isPostId(postId)) {
      throw new Error('Invalid post targetId');
    }

    if (!context.subredditName) {
      throw new Error('context.subredditName is missing');
    }

    const post = await reddit.getPostById(postId);

    if (post.subredditName !== context.subredditName) {
      throw new Error('Post subreddit mismatch');
    }

    if (post.title !== 'Juicy Merge') {
      throw new Error('Refusing to remove unexpected post title');
    }

    await post.remove(false);
    await post.addRemovalNote({
      modNote: 'Removed Juicy Merge game post',
      reasonId: '',
    });

    return c.json<UiResponse>({
      showToast: {
        text: 'Juicy Merge post removed.',
        appearance: 'success',
      },
    }, 200);
  } catch {
    return c.json<UiResponse>({
      showToast: {
        text: 'Failed to remove Juicy Merge post.',
        appearance: 'neutral',
      },
    }, 200);
  }
});

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});