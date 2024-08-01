import { StableBTreeMap, Server } from "azle";
import { v4 as uuidv4 } from "uuid";
import { systemMessage } from "./utils/ai";
import express, { Request, Response } from "express";
import cors from "cors";
import fetch from "node-fetch"; // Ensure you have node-fetch installed
import { Actor, HttpAgent } from "@dfinity/agent";

type Message = {
  role: string;
  content: string;
  id: string;
};

type BaseMessage = {
  role: string;
  content: string;
};

type ConversationPayload = { userIdentity: string };

type AddMessageToConversationPayload = {
  userIdentity: string;
  conversationId: string;
  message: BaseMessage;
};

type Conversation = {
  id: string;
  conversation: Message[];
};

type ErrorMessage = { message: string };

const userConversation = StableBTreeMap<string, Conversation>(0);

// Configure the agent
const agent = new HttpAgent();
const canisterId = "your_canister_id"; // Replace with your actual canister ID
const nftActor = Actor.createActor(idlFactory, { agent, canisterId });

const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY || "your_openai_api_key"; // Set your OpenAI API key in environment variables

export default Server(() => {
  const app = express();
  app.use(express.json());
  app.use(cors());

  app.put("/conversation", (req: Request, res: Response) => {
    const conversationPayload = req.body as ConversationPayload;
    if (!conversationPayload) {
      return res.status(400).json({ message: "Invalid conversation payload" });
    }

    const message = { ...systemMessage, id: uuidv4() };
    const conversation = { id: uuidv4(), conversation: [message] };
    userConversation.insert(conversationPayload.userIdentity, conversation);

    return res.status(200).json({
      conversation,
      id: conversation.id,
      initiator: conversationPayload.userIdentity,
    });
  });

  app.get("/conversation/:userIdentity", (req: Request, res: Response) => {
    const userIdentity = req.params.userIdentity;
    if (!userIdentity) {
      return res.status(404).json({ message: "User Identity is required" });
    }

    const conversation = userConversation.get(userIdentity);
    if ("None" in conversation) {
      return res
        .status(404)
        .json({ message: `No conversation found for ${userIdentity}` });
    }

    return res.status(200).json(conversation.Some);
  });

  app.post("/add/conversation", (req: Request, res: Response) => {
    const payload = req.body;
    const conversation = userConversation.get(payload.userIdentity);
    if ("None" in conversation) {
      return res.status(404).json({
        message: `No conversation found for ${payload.userIdentity}`,
      });
    }

    if (
      typeof payload !== "object" ||
      Object.keys(payload).length === 0 ||
      !payload.message?.content ||
      !payload.message?.role
    ) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const newMessage = {
      role: payload.message.role,
      content: payload.message.content,
      id: uuidv4(),
    };

    const messages = conversation.Some.conversation;
    const updatedMessages = [...messages, newMessage];
    const updatedConversation = {
      id: payload.conversationId,
      conversation: updatedMessages,
    };

    userConversation.insert(payload.userIdentity, updatedConversation);
    return res.status(201).json(newMessage);
  });

  app.delete("/conversation/:userIdentity", (req: Request, res: Response) => {
    const userIdentity = req.params.userIdentity;

    const removedConversation = userConversation.remove(userIdentity);

    if ("None" in removedConversation) {
      return res.status(400).json({
        message: `Cannot delete conversation for user:${userIdentity}`,
      });
    }

    return res
      .status(201)
      .send(`The conversation associated with ${userIdentity} has been deleted`);
  });

  // New endpoint to generate NFT
  app.post("/generate-nft", async (req: Request, res: Response) => {
    const { prompt, userPrincipal } = req.body;

    if (!prompt || !userPrincipal) {
      return res.status(400).json({ message: "NFT prompt and user principal are required" });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPEN_AI_API_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      const result = await response.json();

      if (response.status !== 200) {
        const message = result.error.message;
        return res.status(response.status).json({ message });
      }

      const imageUrl = result.data[0].url;

      // Mint the NFT using the canister
      const nftId = await nftActor.mintNFT(userPrincipal, imageUrl);

      return res.status(200).json({ nftId, imageUrl });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(500).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  });

  return app.listen();
});
