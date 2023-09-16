/**
 * Figma to Discord Webhook Handler
 * @format
 */

// https://discord.com/developers/docs/resources/channel#embed-limits
const MAX_EMBED_DESCRIPTION_LENGTH = 4096;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Trims the length of a string to a maximum length
 * @param content The string to trim
 * @param maxLen The maximum length of the string
 */
const trimParamLength = (content: string, maxLen: number) => {
  if (content.length < maxLen) {
    return content;
  }
  return `${content.substring(0, maxLen - 3)}...`;
};

export interface Env {
  WEBHOOK_PASSWORD: string;
  DISCORD_WEBHOOK_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Invalid request method', { status: 405 });
    }
    const requestBody = (await request.json()) as any;

    // hit the ball back to Figma
    if (requestBody.event_type === 'PING') {
      return new Response('PONG', { status: 200 });
    }

    // check the webhook password
    if (requestBody.passcode !== env.WEBHOOK_PASSWORD) {
      return new Response('Invalid Passcode', { status: 403 });
    }

    // extract information from Figma webhook; adjust this part based on the specifics of the Figma webhook payload
    // - https://www.figma.com/developers/api#webhooks-v2-payloads
    const figmaData = {
      event_id: requestBody.webhook_id,
      event_type: requestBody.event_type,
      file: requestBody.file_name,
      user: requestBody.triggered_by?.handle?.length ? requestBody.triggered_by?.handle : 'Unknown',
      description: requestBody.description ? requestBody.description : requestBody.event_type,
    };

    // format the message for Discord
    // - https://discord.com/developers/docs/resources/webhook
    const discordMessage = {
      username: `Figma Update By ${figmaData.user}`,
      content: trimParamLength(`${figmaData.description}`, MAX_CONTENT_LENGTH),
      embeds: [
        {
          author: {
            name: figmaData.user,
          },
          title: `Figma Update - ${figmaData.file}`,
          description: `${figmaData.event_type}`,
          footer: {
            text: `Event ID: ${figmaData.event_id}`,
          },
        },
      ],
    };

    // loop around certain data
    if (requestBody.created_components) {
      // @ts-ignore
      discordMessage.embeds.push({
        title: 'Created Components',
        description: trimParamLength(
          requestBody.created_components.map((component: any) => component.name).join(', '),
          MAX_EMBED_DESCRIPTION_LENGTH
        ),
      });
    }
    if (requestBody.created_styles) {
      // @ts-ignore
      discordMessage.embeds.push({
        title: 'Created Styles',
        description: trimParamLength(requestBody.created_styles.map((style: any) => style.name).join(', '), MAX_EMBED_DESCRIPTION_LENGTH),
      });
    }
    if (requestBody.modified_components) {
      // @ts-ignore
      discordMessage.embeds.push({
        title: 'Modified Components',
        description: trimParamLength(
          requestBody.modified_components.map((component: any) => component.name).join(', '),
          MAX_EMBED_DESCRIPTION_LENGTH
        ),
      });
    }
    if (requestBody.modified_styles) {
      // @ts-ignore
      discordMessage.embeds.push({
        title: 'Modified Styles',
        description: trimParamLength(requestBody.modified_styles.map((style: any) => style.name).join(', '), MAX_EMBED_DESCRIPTION_LENGTH),
      });
    }

    // send the formatted message to Discord via its webhook
    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordMessage),
    });

    return new Response('Webhook handled', { status: 200 });
  },
};
