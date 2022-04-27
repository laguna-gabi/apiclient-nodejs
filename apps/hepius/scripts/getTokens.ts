import { Environments } from '@argus/pandora';
import { sign } from 'jsonwebtoken';
import { Model, connect, disconnect, model } from 'mongoose';
import { v4 } from 'uuid';
import { Member, MemberDocument, MemberDto } from '../src/member';
import { ConfigsService } from '../src/providers';
import { User, UserDocument, UserDto } from '../src/user';

export async function getTokens() {
  const { uri } = await new ConfigsService().createMongooseOptions();
  await connect(uri);
  const memberModel: Model<MemberDocument> = model<MemberDocument>(Member.name, MemberDto);
  const userModel: Model<UserDocument> = model<UserDocument>(User.name, UserDto);

  /**
   * In here we are generating authId for members if they dont have it.
   * It's possible for member to not have authId (if web member), but
   * we want to add the authId so we can do queries for that members.
   * This is done only for local environments.
   */
  if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
    const members = await memberModel.find({ authId: null });
    members.map(async (member) => {
      await memberModel.findOneAndUpdate(
        { _id: member._id },
        {
          $set: {
            authId: v4(),
          },
        },
      );
    });
  }

  const members = await memberModel.find();
  const mappedMembers = members.map((member: MemberDocument) => {
    return {
      id: member._id,
      authId: member.authId,
      token: sign({ sub: member.authId }, 'key-123'),
    };
  });
  console.log(
    '\x1b[44m%s\x1b[0m',
    '\n----------------------------------------------------------------\n' +
      '---------------------------- MEMBERS ---------------------------\n' +
      '----------------------------------------------------------------',
  );
  console.log(mappedMembers);

  const users = await userModel.find();
  const mappedUsers = users.map((user: UserDocument) => {
    return {
      id: user._id,
      authId: user.authId,
      token: sign({ sub: user.authId }, 'key-123'),
    };
  });
  console.log(
    '\x1b[44m%s\x1b[0m',
    '\n----------------------------------------------------------------\n' +
      '----------------------------- USERS ----------------------------\n' +
      '----------------------------------------------------------------',
  );
  console.log(mappedUsers);

  await disconnect();
}
