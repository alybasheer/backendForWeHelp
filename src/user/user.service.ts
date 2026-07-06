import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
    private user = [{
        id : 1,
        name : 'Ali',
        role : 'admin'

    },
 {
        id : 2,
        name : 'Ahmed',
        role : 'volunteer'
 },
  {
        id : 3,
        name : 'Aisha',
        role : 'help seeker'
  }
 ];
 findAllUsers(){
    return this.user;
 }
 findByRole(role: String){
    return this.user.find(user => role == user.role); }


}
