import { JOIN_ROOM, CREATE_ROOM, UPDATE_ROOM } from '_context/types';

import { Action, State } from './room.type';

export const initialState: State = {
    room: null,
    createRoom: () => null,
};

//reducer
export default function roomReducer(state: State = initialState, action: Action) {
    const { type, payload } = action;

    switch (type) {
        case CREATE_ROOM:
            return {
                ...state,
            };

        case JOIN_ROOM:
            return {
                ...state,
            };

        case UPDATE_ROOM:
            return {
                ...state,
                room: payload,
            };

        default:
            return state;
    }
}