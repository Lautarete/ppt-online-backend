import express from "express";
import cors from "cors";
import { configDotenv } from "dotenv";
import { createCUID, createID } from "./createID";

import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

function runAPI() {
  configDotenv({
    path: ".env",
  });
  const server = express();
  const PORT = process.env.PORT || 3001;
  server.use(express.json());
  server.use(cors());

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    } as ServiceAccount),
    databaseURL: "https://ppt-online-desafio-default-rtdb.firebaseio.com/",
  });
  // aca van todas las referencias a usar en la API

  const db = getDatabase();
  const firestore = getFirestore();

  const firestoreRoomsRef = firestore.collection("rooms");
  const roomsRef = db.ref("/rooms");

  const firestoreUsersRef = firestore.collection("users");

  server.get("/", (request, response) => {
    response.send(
      `Hola, esta es la API y te estoy enviando data al puerto ${PORT}`,
    );
  });

  // CREATE ROOM
  server.post("/room", (request, response) => {
    const Id = createID();
    const CUId = createCUID();

    const newRoomRef = firestoreRoomsRef.doc(CUId);
    newRoomRef.set({
      roomId: Id,
    });

    response.send({ CUId });
  });

  // GET ROOM ID
  server.get("/room/:CUId", (request, response) => {
    const { CUId } = request.params;

    const thisFirestoreRoomRef = firestoreRoomsRef.doc(CUId);
    thisFirestoreRoomRef.get().then((roomSnap) => {
      if (roomSnap.exists) {
        const roomId = roomSnap.data()!.roomId;
        response.send({ roomId });
      } else {
        response.status(404).json({
          error: "Room no encontrada",
          id: request.params.CUId,
        });
      }
    });
  });

  // ENTER ROOM AS A USER
  server.post("/room/:userName", (request, response) => {
    const { userName } = request.params;
    const { CUId } = request.body;
    const { roomId } = request.body;
    const thisCurrentGameRef = db.ref("/rooms/" + roomId + "/currentGame");

    if (!CUId) {
      return response.status(404).json({
        error: "CUId incorrecto o no existe",
      });
    }

    const thisUserRef = firestoreUsersRef.doc(userName);
    thisUserRef.get().then((userSnap) => {
      // con early return
      if (!userSnap.exists) {
        return response.status(400).json({
          error: "El usuario no existe",
          userName,
        });
      }
      thisCurrentGameRef.get().then((roomSnap) => {
        // return response.send(!roomSnap.exists());
        if (!roomSnap.exists()) {
          // si no existe la Room en la RTDB se crea aca mismo

          //  ya se que esto es horrible, pero bueno

          const thisFirestoreRoomRef = firestoreRoomsRef.doc(CUId.toString());
          return thisFirestoreRoomRef.get().then((firestoreRoomSnap) => {
            if (!firestoreRoomSnap.exists) {
              return response.status(404).json({
                error: "CUId incorrecto o no existe",
              });
            }
            // Firestore
            thisFirestoreRoomRef.update({
              [`history.${userName}`]: 0,
            });
            // RTDB
            thisCurrentGameRef.set({
              [userName]: {
                choice: "rock",
                start: false,
              },
            });
            return response.status(200).json({
              status: `El usuario ${userName} entró exitosamente a Room existente`,
            });
          });
        }

        const currentGame = roomSnap.val();
        const currentGamePlayers = Object.keys(currentGame).length;
        if (currentGamePlayers >= 2) {
          // hay mas de 2 players
          return response.status(400).json({
            error: "Room está llena",
          });
        }

        if (currentGame[userName]) {
          // el usuario ya esta dentro de la Room
          return response.status(400).json({
            error: `El usuario ${userName} ya está dentro de la Room`,
          });
        }

        // entrar a la sala
        //  ya se que esto es horrible, pero bueno
        const thisFirestoreRoomRef = firestoreRoomsRef.doc(CUId.toString());
        thisFirestoreRoomRef.get().then((firestoreRoomSnap) => {
          if (!firestoreRoomSnap.exists) {
            return response.status(404).json({
              error: "CUId incorrecto o no existe",
            });
          }
          // Firestore
          thisFirestoreRoomRef.update({
            [`history.${userName}`]: 0,
          });
          // RTDB
          thisCurrentGameRef.update({
            [userName]: {
              choice: "rock",
              start: false,
            },
          });
          return response.status(200).json({
            status: `El usuario ${userName} entró exitosamente a Room existente`,
          });
        });
      });
    });
  });

  // CREATE USER
  server.post("/user/:userName", (request, response) => {
    const { userName } = request.params;
    const thisUserRef = firestoreUsersRef.doc(userName);

    thisUserRef.get().then((userSnap) => {
      if (userSnap.exists) {
        response.status(400).json({
          error: `El User ${userName} ya existe`,
        });
      } else {
        thisUserRef
          .set({
            exist: true,
          })
          .then((res) => {
            response.status(200).json({
              succes: `User ${userName} se creó correctamente`,
            });
          })
          .catch((error) => {
            response.status(500).json({
              error: `Ocurrio un error inesperado al crear el usuario`,
              userName,
            });
          });
      }
    });
  });

  // GET PLAYERS
  server.get("/game/players", (request, response) => {
    const { CUId } = request.body;

    const thisCurrentGameRef = firestore.doc("/rooms/" + CUId);

    thisCurrentGameRef.get().then((gameSnap) => {
      if (!gameSnap.exists) {
        return response.status(400).json({
          error: "Room Id no existe",
          CUId,
        });
      }

      const gameData = gameSnap.data();

      const entries = Object.entries(gameData?.history);
      const players = [entries[0][0], entries[1][0]];

      // response.status(200).json(players);
      // console.log(gameData.hisor);

      response.status(200).json(players);
    });
  });

  // SET READY TO PLAY
  server.patch("/game", (request, response) => {
    const { userName } = request.body;
    const { roomId } = request.body;
    const queryStart = request.query.start;

    if (queryStart != "true" && queryStart != "false") {
      return response.status(400).json({
        error: "Query 'start' tiene que ser 'true' o 'false'",
        start: queryStart,
      });
    }

    const booleanQueryStart = queryStart === "true";
    const currentPlayerRef = db.ref(
      "/rooms/" + roomId + "/currentGame/" + userName,
    );

    currentPlayerRef.get().then((snap) => {
      if (!snap.exists()) {
        return response.status(404).json({
          error: `Room ID o User Name no existen`,
          roomId,
          userName,
        });
      }

      currentPlayerRef.update({
        start: booleanQueryStart,
      });
      response.status(202).json({
        succes: `Users ${userName} start seted to ${queryStart}`,
      });
    });
  });

  // SET PLAY
  server.patch("/game/play", (request, response) => {
    const { userName } = request.body;
    const { roomId } = request.body;
    const { play } = request.query;

    const currentPlayerRef = db.ref(
      "/rooms/" + roomId + "/currentGame/" + userName,
    );

    currentPlayerRef.get().then((snap) => {
      if (!snap.exists()) {
        return response.status(404).json({
          error: `Room ID o User Name no existen`,
          roomId,
          userName,
        });
      }

      currentPlayerRef.update({
        choice: play,
      });
      response.status(202).json({
        succes: `Users ${userName} choice seted to ${play}`,
      });
    });
  });

  // SET GAME HISTORY
  server.patch("/game/history", (request, response) => {
    const { CUId } = request.body;
    const winnerUserName = request.body.winner;

    const thisRoomRef = firestoreRoomsRef.doc(CUId.toString());
    thisRoomRef.get().then((roomSnap) => {
      if (!roomSnap.exists) {
        return response.status(404).json({
          error: "ID incorrecto",
          id: CUId,
        });
      }
      thisRoomRef.update({
        [`history.${winnerUserName}`]: FieldValue.increment(1),
      });
      return response.status(200).json({
        succes: `Se actualizó existosamente el historial`,
      });
    });
  });

  server.listen(PORT, () => {
    console.log(`Escuchando servidor en el puerto ${PORT}`);
  });
}

runAPI();
