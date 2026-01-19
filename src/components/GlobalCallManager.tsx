import { useCallContext } from "@/contexts/CallContext";
import VideoCall from "./VideoCall";
import AudioCall from "./AudioCall";
import GroupVideoCall from "./GroupVideoCall";
import GroupAudioCall from "./GroupAudioCall";
import IncomingCallNotification from "./IncomingCallNotification";

const GlobalCallManager = () => {
  const {
    currentUserId,
    incomingCall,
    activeCall,
    activeGroupCall,
    handleAcceptCall,
    handleDeclineCall,
    handleCloseCall,
    handleCloseGroupCall,
    handleTransitionToGroupCall,
  } = useCallContext();

  if (!currentUserId) return null;

  return (
    <>
      {/* Incoming call notification */}
      {incomingCall && (
        <IncomingCallNotification
          callerName={incomingCall.callerName}
          callerId={incomingCall.callerId}
          currentUserId={currentUserId}
          callType={incomingCall.callType}
          isGroupCall={incomingCall.isGroupCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Active video call */}
      {activeCall && activeCall.callType === "video" && (
        <VideoCall
          isOpen={true}
          onClose={handleCloseCall}
          chatId={activeCall.chatId}
          currentUserId={currentUserId}
          otherUserId={activeCall.otherUserId}
          otherUserName={activeCall.otherUserName}
          isInitiator={activeCall.isInitiator}
          onTransitionToGroupCall={(roomId, participants) => 
            handleTransitionToGroupCall(roomId, "video", participants)
          }
        />
      )}

      {/* Active audio call */}
      {activeCall && activeCall.callType === "audio" && (
        <AudioCall
          isOpen={true}
          onClose={handleCloseCall}
          chatId={activeCall.chatId}
          currentUserId={currentUserId}
          otherUserId={activeCall.otherUserId}
          otherUserName={activeCall.otherUserName}
          isInitiator={activeCall.isInitiator}
          onTransitionToGroupCall={(roomId, participants) => 
            handleTransitionToGroupCall(roomId, "audio", participants)
          }
        />
      )}

      {/* Active group video call */}
      {activeGroupCall && activeGroupCall.callType === "video" && (
        <GroupVideoCall
          isOpen={true}
          onClose={handleCloseGroupCall}
          roomId={activeGroupCall.roomId}
          currentUserId={currentUserId}
          initialParticipants={activeGroupCall.participants}
        />
      )}

      {/* Active group audio call */}
      {activeGroupCall && activeGroupCall.callType === "audio" && (
        <GroupAudioCall
          isOpen={true}
          onClose={handleCloseGroupCall}
          roomId={activeGroupCall.roomId}
          currentUserId={currentUserId}
          initialParticipants={activeGroupCall.participants}
        />
      )}
    </>
  );
};

export default GlobalCallManager;
