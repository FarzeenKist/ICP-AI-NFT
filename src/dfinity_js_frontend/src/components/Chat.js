import React, { useState, useEffect } from "react";
import useApi from "../hooks/useApi";
import Loading from "./Loading";
import { login, logout } from "../utils/auth";
import toast from "react-hot-toast";
import { getConversation } from "../utils/chat";
import TextInput from "./TextInput";
import { encryptData } from "../utils/encryptData";

export default function Chat() {
  const [question, setQuestion] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [nftPrompt, setNftPrompt] = useState("");
  const { loading, chatCompletion, chatMessage, setChatMessage, generateNft, uploading } = useApi();

  const updateChatMessage = async () => {
    if (window.auth.principalText && window.auth.isAuthenticated) {
      const conversation = await getConversation(window.auth.principalText);
      console.log(conversation);
      if (conversation) {
        setChatMessage(conversation.conversation);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.auth.isAuthenticated) {
      toast.error("You are not authenticated");
      return;
    }

    const openaiKey = localStorage.getItem("icp-dai-open-ai");
    if (!openaiKey) {
      toast.error("No openai key found");
      return;
    }

    if (question) {
      const history = [...chatMessage, { content: question, role: "user" }];
      setChatMessage(() => [...history]);
      await chatCompletion(history);
      setQuestion("");
    }
  };

  const handleGenerateNFT = async (e) => {
    e.preventDefault();
    if (!window.auth.isAuthenticated) {
      toast.error("You are not authenticated");
      return;
    }
  
    const openaiKey = localStorage.getItem("icp-dai-open-ai");
    if (!openaiKey) {
      toast.error("No openai key found");
      return;
    }
  
    const userPrincipal = window.auth.principalText;
  
    if (nftPrompt && userPrincipal) {
      try {
        const response = await fetch("/generate-nft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: nftPrompt, userPrincipal }),
        });
  
        const result = await response.json();
        if (response.ok) {
          console.log("NFT generated:", result.nftId, result.imageUrl);
          toast.success("NFT generated successfully!");
        } else {
          toast.error(`Error: ${result.message}`);
        }
      } catch (error) {
        toast.error(`Error: ${error.message}`);
      }
    }
  };
}  